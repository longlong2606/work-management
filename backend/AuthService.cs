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

    public static UserDto? GetCurrentUser(HttpContext context)
    {
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var payload = VerifyToken(token);
        if (payload == null) return null;

        using var conn = Database.GetConnection();
        var user = conn.QueryFirstOrDefault<UserDto>(
            "SELECT id, username, full_name, email, phone, role, department, status FROM users WHERE id = @id",
            new { id = payload.user_id });

        if (user == null || user.status != "active") return null;
        return user;
    }
}
