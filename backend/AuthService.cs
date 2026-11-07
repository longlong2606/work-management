using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Dapper;

namespace WorkManagement.Api;

public class UserDto
{
    public long id { get; set; }
    public string username { get; set; } = "";
    public string full_name { get; set; } = "";
    public string email { get; set; } = "";
    public string? phone { get; set; } = "";
    public string role { get; set; } = "staff";
    public string? department { get; set; } = "";
    public string status { get; set; } = "active";
    public bool can_manage_schedule { get; set; }
    public bool can_manage_tasks { get; set; }
    public bool can_manage_staff { get; set; }
    public bool can_evaluate { get; set; }
    public bool can_manage_cp { get; set; }
}

public class TokenPayload
{
    public long user_id { get; set; }
    public string username { get; set; } = "";
    public string role { get; set; } = "";
    public long exp { get; set; }
}

public static class AuthService
{
    private const string SecretKey = "work_mgmt_secret_jwt_key_2026!#";

    public static string CreateToken(long userId, string username, string role)
    {
        var payload = new TokenPayload
        {
            user_id = userId,
            username = username,
            role = role,
            exp = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + 86400 * 7 // 7 days
        };

        var json = JsonSerializer.Serialize(payload);
        var b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(json))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(SecretKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(b64));
        var signature = Convert.ToHexString(hash).ToLower();

        return $"{b64}.{signature}";
    }

    public static TokenPayload? VerifyToken(string token)
    {
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 2) return null;

            var b64 = parts[0];
            var sig = parts[1];

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(SecretKey));
            var expectedSig = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(b64))).ToLower();
            if (!string.Equals(sig, expectedSig, StringComparison.OrdinalIgnoreCase)) return null;

            // Restore padding
            var pad = b64.Length % 4 == 0 ? "" : new string('=', 4 - b64.Length % 4);
            var b64Fixed = b64.Replace('-', '+').Replace('_', '/') + pad;
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(b64Fixed));
            var payload = JsonSerializer.Deserialize<TokenPayload>(json);

            if (payload == null || payload.exp < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
                return null;

            return payload;
        }
        catch
        {
            return null;
        }
    }

    public const string MasterApiKey = "wms_sk_live_9f83b2a7e4c1d68051e2a9b3c4f7d8e0";

    public static bool IsMasterApiKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;
        var trimmed = key.Trim();
        if (trimmed == MasterApiKey) return true;

        try
        {
            using var conn = Database.GetConnection();
            var dbKey = conn.QueryFirstOrDefault<string>(
                "SELECT value FROM system_settings WHERE key = 'api_secret_key'");
            if (!string.IsNullOrWhiteSpace(dbKey) && trimmed == dbKey.Trim())
            {
                return true;
            }
        }
        catch { }

        return false;
    }

    public static UserDto GetMasterAdminUser()
    {
        try
        {
            using var conn = Database.GetConnection();
            var admin = conn.QueryFirstOrDefault<UserDto>(@"
                SELECT id, username, full_name, email, phone, role, department, status
                FROM users
                WHERE role = 'admin'
                ORDER BY id ASC
                LIMIT 1");

            if (admin != null)
            {
                admin.can_manage_schedule = true;
                admin.can_manage_tasks = true;
                admin.can_manage_staff = true;
                admin.can_evaluate = true;
                admin.can_manage_cp = true;
                return admin;
            }
        }
        catch { }

        return new UserDto
        {
            id = 1,
            username = "admin",
            full_name = "Quản Trị Hệ Thống (Master API Key)",
            role = "admin",
            status = "active",
            can_manage_schedule = true,
            can_manage_tasks = true,
            can_manage_staff = true,
            can_evaluate = true,
            can_manage_cp = true
        };
    }

    public static UserDto? GetCurrentUser(HttpContext context)
    {
        // 1. Check Master API Secret Key via X-API-Key header or query parameter
        var apiKeyHeader = context.Request.Headers["X-API-Key"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(apiKeyHeader))
        {
            apiKeyHeader = context.Request.Query["api_key"].FirstOrDefault();
        }

        if (!string.IsNullOrEmpty(apiKeyHeader) && IsMasterApiKey(apiKeyHeader))
        {
            return GetMasterAdminUser();
        }

        // 2. Check Authorization header (Supports both Bearer <token> and Bearer <api_secret_key>)
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader))
        {
            var tokenOrKey = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? authHeader.Substring("Bearer ".Length).Trim()
                : authHeader.Trim();

            if (IsMasterApiKey(tokenOrKey))
            {
                return GetMasterAdminUser();
            }

            var payload = VerifyToken(tokenOrKey);
            if (payload != null)
            {
                using var conn = Database.GetConnection();
                var user = conn.QueryFirstOrDefault<UserDto>(@"
                    SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role, u.department, u.status,
                           COALESCE(r.can_manage_schedule, 0) AS can_manage_schedule,
                           COALESCE(r.can_manage_tasks, 0) AS can_manage_tasks,
                           COALESCE(r.can_manage_staff, CASE WHEN u.role = 'admin' THEN 1 ELSE 0 END) AS can_manage_staff,
                           COALESCE(r.can_evaluate, 0) AS can_evaluate,
                           COALESCE(r.can_manage_cp, 0) AS can_manage_cp
                    FROM users u
                    LEFT JOIN roles r ON r.id = u.role
                    WHERE u.id = @id",
                    new { id = payload.user_id });

                if (user != null && user.status == "active")
                {
                    if (user.role == "admin" || user.id == 1)
                    {
                        user.can_manage_staff = true;
                        user.can_manage_schedule = true;
                        user.can_manage_tasks = true;
                        user.can_evaluate = true;
                        user.can_manage_cp = true;
                    }
                    else if (user.role == "leader" || user.role == "manager" || (user.username != null && user.username.ToLower().Contains("leader")))
                    {
                        user.can_manage_schedule = true;
                    }
                    return user;
                }
            }
        }

        return null;
    }
}
