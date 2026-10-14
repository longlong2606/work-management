/**
 * LAB COMPETENCY EVALUATION DATA (Dữ liệu đánh giá năng lực thành viên Lab)
 * Trích xuất từ tài liệu 65 trang: LAB | ĐÁNH GIÁ NĂNG LỰC THÀNH VIÊN
 * Thang điểm:
 *  - 1–3: Cần hướng dẫn sát
 *  - 4–6: Có nền tảng, cần hỗ trợ ở việc phức tạp
 *  - 7–8: Làm độc lập ổn định
 *  - 9–10: Chuyên sâu, có thể dẫn dắt/đào tạo người khác
 */

export const COMPETENCY_GROUPS = [
  {
    id: "group1",
    name: "Nhóm 1 | Đối Ngoại – Quản Lý Dự Án – Đào Tạo",
    shortName: "Quản Lý & Đối Ngoại",
    code: "QL_DN",
    color: "#2563eb",
    bgColor: "#eff6ff",
    borderColor: "#bfdbfe",
    accentColor: "#1d4ed8",
    description: "Kỹ năng giao tiếp, quan hệ đối tác, quản lý tiến độ, đào tạo và phát triển đội ngũ",
    criteria: [
      { id: "c1", code: "C1", name: "Giao tiếp & thuyết trình", desc: "Trình bày ý tưởng rõ ràng, súc tích trước khách hàng, đối tác và hội đồng" },
      { id: "c2", code: "C2", name: "Khai thác nhu cầu khách hàng / đối tác", desc: "Lắng nghe, đào sâu vấn đề thực tế, hiểu rõ yêu cầu và bài toán kinh doanh" },
      { id: "c3", code: "C3", name: "Đề xuất giá trị / thương lượng", desc: "Xây dựng đề xuất giải pháp có giá trị thực tế, đàm phán phạm vi và chi phí" },
      { id: "c4", code: "C4", name: "Lập kế hoạch & ưu tiên", desc: "Xây dựng roadmap, phân bổ nguồn lực, quản lý timeline và mức độ ưu tiên" },
      { id: "c5", code: "C5", name: "Quản lý task, deadline & rủi ro", desc: "Theo dõi tiến độ, kiểm soát backlog, phát hiện rủi ro sớm và có phương án dự phòng" },
      { id: "c6", code: "C6", name: "Điều phối nhóm, mentor & đào tạo", desc: "Phân chia công việc hợp lý, truyền cảm hứng, hướng dẫn và đào tạo thành viên mới" }
    ]
  },
  {
    id: "group2",
    name: "Nhóm 2 | Lập Trình – Triển Khai Hệ Thống",
    shortName: "Kỹ Thuật & Hệ Thống",
    code: "KT_HT",
    color: "#059669",
    bgColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    accentColor: "#047857",
    description: "Năng lực lập trình, kiến trúc hệ thống, tích hợp API, triển khai AI/Agent và vận hành",
    criteria: [
      { id: "c7", code: "C7", name: "Nền tảng lập trình & tư duy hệ thống", desc: "Nắm vững thuật toán, OOP, cấu trúc dữ liệu và tư duy kiến trúc toàn hệ thống" },
      { id: "c8", code: "C8", name: "Chất lượng code, cấu trúc & version control", desc: "Code sạch, tuân thủ Clean Code, review code chặt chẽ, thành thạo Git workflow" },
      { id: "c9", code: "C9", name: "Xử lý dữ liệu, API & tích hợp", desc: "Thiết kế RESTful API, tối ưu truy vấn cơ sở dữ liệu, ETL và tích hợp hệ thống bên thứ ba" },
      { id: "c10", code: "C10", name: "Triển khai mô hình AI/CV/NLP/Agent", desc: "Fine-tune, optimize, đóng gói mô hình AI, LLM, Agentic workflow vào production" },
      { id: "c11", code: "C11", name: "Testing, deployment & monitoring", desc: "Unit/Integration test, thiết lập CI/CD pipeline, Docker container, logging & monitor" },
      { id: "c12", code: "C12", name: "Debugging, độ ổn định & bảo mật", desc: "Xử lý sự cố nhanh, tối ưu hiệu năng dưới tải cao, bảo vệ an toàn bảo mật hệ thống" }
    ]
  },
  {
    id: "group3",
    name: "Nhóm 3 | Research",
    shortName: "Research & AI",
    code: "RESEARCH",
    color: "#7c3aed",
    bgColor: "#f5f3ff",
    borderColor: "#ddd6fe",
    accentColor: "#6d28d9",
    description: "Nghiên cứu học thuật, tìm kiếm khoảng trống, thiết kế thực nghiệm và viết bài báo",
    criteria: [
      { id: "c13", code: "C13", name: "Tìm kiếm & phản biện tài liệu", desc: "Khảo sát tài liệu nghiên cứu (SOTA), phân tích điểm mạnh/yếu của các công trình trước" },
      { id: "c14", code: "C14", name: "Câu hỏi nghiên cứu, khoảng trống & tính mới", desc: "Xác định research gap rõ ràng, đề xuất hướng tiếp cận mới có tính học thuật cao" },
      { id: "c15", code: "C15", name: "Thiết kế thực nghiệm & baseline", desc: "Thiết lập môi trường đo đạc khách quan, chọn baseline công bằng và thiết kế testbed" },
      { id: "c16", code: "C16", name: "Thu thập, xử lý & quản trị dữ liệu", desc: "Xây dựng bộ dữ liệu benchmark, gán nhãn, chuẩn hóa và quản lý metadata minh bạch" },
      { id: "c17", code: "C17", name: "Chỉ số đánh giá, thống kê & tái lập", desc: "Chọn metrics đánh giá phù hợp, kiểm định ý nghĩa thống kê và đảm bảo khả năng tái lập" },
      { id: "c18", code: "C18", name: "Viết học thuật & trích dẫn", desc: "Soạn thảo bài báo chuẩn IEEE/ACM/Springer, lập luận sắc bén, trích dẫn chuẩn mực" }
    ]
  }
];

export const INITIAL_MEMBERS = [
  {
    id: "TV01",
    name: "Lê Châu Phúc Vinh",
    role: "Research Lead",
    roleLevel: "Lead",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    department: "Phòng Nghiên Cứu AI & Khoa Học Dữ Liệu",
    desiredDirection: "Phát triển các mô hình AI Foundation, dẫn dắt các đề tài quốc tế cấp Lab và hướng dẫn công bố Q1.",
    commitmentLevel: "100% Toàn thời gian",
    evidenceNotes: "Đã chủ trì 2 đề tài quốc tế, hướng dẫn 5 sinh viên xuất sắc, hoàn thành hệ thống benchmark tự động.",
    scores: {
      c1: 7, c2: 7, c3: 7, c4: 8, c5: 8, c6: 6,
      c7: 8, c8: 8, c9: 7, c10: 7, c11: 8, c12: 8,
      c13: 8, c14: 8, c15: 8, c16: 8, c17: 8, c18: 9
    }
  },
  {
    id: "TV02",
    name: "Nguyễn Anh Huy",
    role: "Project Lead",
    roleLevel: "Lead",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    department: "Ban Quản Lý Dự Án & Kỹ Thuật",
    desiredDirection: "Nâng cao năng lực quản trị dự án phần mềm theo Agile, mở rộng kết nối đối tác doanh nghiệp.",
    commitmentLevel: "Rất cao (Cam kết hoàn thành đúng deadline)",
    evidenceNotes: "Quản lý xuất sắc dự án Kiosk & Web phân ca, xử lý tốt các yêu cầu phát sinh từ khách hàng.",
    scores: {
      c1: 4, c2: 5, c3: 5, c4: 5, c5: 7, c6: 5,
      c7: 7, c8: 7, c9: 7, c10: 7, c11: 8, c12: 8,
      c13: 5, c14: 5, c15: 5, c16: 5, c17: 5, c18: 5
    }
  },
  {
    id: "TV03",
    name: "Phan Công Danh",
    role: "Project Lead",
    roleLevel: "Lead",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    department: "Ban Hợp Tác Doanh Nghiệp & Dự Án",
    desiredDirection: "Đàm phán đối tác, phát triển mảng ứng dụng công nghệ thực tế và gọi vốn nghiên cứu.",
    commitmentLevel: "Toàn tâm toàn ý cho dự án Lab",
    evidenceNotes: "Thương lượng thành công biên bản ghi nhớ hợp tác thử nghiệm giải pháp Lab với 2 đơn vị.",
    scores: {
      c1: 6, c2: 8, c3: 8, c4: 7, c5: 6, c6: 7,
      c7: 7, c8: 6, c9: 6, c10: 6, c11: 6, c12: 6,
      c13: 5, c14: 5, c15: 5, c16: 6, c17: 6, c18: 7
    }
  },
  {
    id: "TV04",
    name: "Nguyễn Thành Công",
    role: "Core Member",
    roleLevel: "Core",
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
    department: "Nhóm Phát Triển Backend & Cloud",
    desiredDirection: "Định hướng trở thành Tech Lead mảng backend và Cloud Architecture.",
    commitmentLevel: "Tích cực tham gia các buổi sprint",
    evidenceNotes: "Hỗ trợ tái cấu trúc database, viết test case cho các API ca làm việc trọng yếu.",
    scores: {
      c1: 3, c2: 1, c3: 1, c4: 6, c5: 7, c6: 1,
      c7: 6, c8: 6, c9: 1, c10: 2, c11: 4, c12: 5,
      c13: 4, c14: 4, c15: 5, c16: 4, c17: 4, c18: 3
    }
  },
  {
    id: "TV05",
    name: "Nguyễn Võ Thanh Bảo",
    role: "Contributor",
    roleLevel: "Contributor",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    department: "Nhóm Lập Trình Ứng Dụng",
    desiredDirection: "Chuyên sâu lập trình Full-stack và tối ưu giao diện trải nghiệm người dùng.",
    commitmentLevel: "Tập trung các task được giao",
    evidenceNotes: "Hoàn thành đúng tiến độ các module quản lý nhân sự và giao diện phân ca.",
    scores: {
      c1: 5, c2: 2, c3: 1, c4: 6, c5: 5, c6: 3,
      c7: 5, c8: 5, c9: 0, c10: 0, c11: 0, c12: 0,
      c13: 0, c14: 0, c15: 0, c16: 0, c17: 0, c18: 0
    }
  },
  {
    id: "TV06",
    name: "Phạm Đông Nhật Nam",
    role: "Contributor",
    roleLevel: "Contributor",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    department: "Nhóm Kỹ Thuật AI",
    desiredDirection: "Nghiên cứu thị giác máy tính và ứng dụng Edge AI trên thiết bị di động.",
    commitmentLevel: "Cam kết 20h/tuần tại Lab",
    evidenceNotes: "Thực hiện tốt baseline mô hình phát hiện đối tượng, báo cáo tiến độ tuần đúng hạn.",
    scores: {
      c1: 1, c2: 4, c3: 5, c4: 3, c5: 3, c6: 2,
      c7: 7, c8: 6, c9: 0, c10: 7, c11: 0, c12: 0,
      c13: 0, c14: 0, c15: 0, c16: 0, c17: 0, c18: 0
    }
  },
  {
    id: "TV07",
    name: "Đặng Gia Hưng",
    role: "Core Member",
    roleLevel: "Core",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    department: "Nhóm Tích Hợp Hệ Thống",
    desiredDirection: "Phát triển kỹ năng DevOps, Containerization và điều phối cụm server Lab.",
    commitmentLevel: "Chủ động đề xuất cải tiến",
    evidenceNotes: "Triển khai thành công môi trường Docker staging cho dự án quản lý ca làm việc.",
    scores: {
      c1: 1, c2: 1, c3: 1, c4: 3, c5: 3, c6: 1,
      c7: 6, c8: 5, c9: 6, c10: 1, c11: 6, c12: 1,
      c13: 2, c14: 1, c15: 2, c16: 4, c17: 4, c18: 2
    }
  },
  {
    id: "TV08",
    name: "Huỳnh Vĩnh Phú",
    role: "Contributor",
    roleLevel: "Contributor",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    department: "Nhóm Hỗ Trợ Kỹ Thuật",
    desiredDirection: "Rèn luyện kỹ năng giải quyết bug và tham gia phát triển API.",
    commitmentLevel: "Hỗ trợ nhiệt tình khi Lab có đợt cao điểm",
    evidenceNotes: "Phát hiện và fix lỗi hiển thị trên một số dòng điện thoại Android.",
    scores: {
      c1: 1, c2: 1, c3: 1, c4: 3, c5: 5, c6: 1,
      c7: 6, c8: 5, c9: 0, c10: 0, c11: 0, c12: 0,
      c13: 0, c14: 0, c15: 0, c16: 0, c17: 0, c18: 0
    }
  },
  {
    id: "TV09",
    name: "Diệp Thị Ngọc Trân",
    role: "Contributor",
    roleLevel: "Contributor",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    department: "Nhóm Thiết Kế UI/UX & Frontend",
    desiredDirection: "Định hướng trở thành Product Designer, làm chủ design system.",
    commitmentLevel: "Đảm bảo đúng các mốc thiết kế",
    evidenceNotes: "Đóng góp thiết kế giao diện mobile responsive trực quan, phối màu hài hòa.",
    scores: {
      c1: 2, c2: 1, c3: 1, c4: 2, c5: 2, c6: 3,
      c7: 4, c8: 3, c9: 3, c10: 5, c11: 0, c12: 0,
      c13: 0, c14: 0, c15: 0, c16: 0, c17: 0, c18: 0
    }
  },
  {
    id: "TV10",
    name: "Lê Ngọc Vi",
    role: "Learning Member",
    roleLevel: "Learning",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    department: "Tổ Thực Tập Sinh R&D",
    desiredDirection: "Học hỏi quy trình làm việc nhóm chuyên nghiệp, nâng cao kỹ năng code frontend.",
    commitmentLevel: "Tập trung học hỏi và hoàn thành bài tập mentor giao",
    evidenceNotes: "Tham gia đầy đủ các buổi training, có tinh thần cầu thị cao.",
    scores: {
      c1: 5, c2: 3, c3: 5, c4: 3, c5: 3, c6: 4,
      c7: 4, c8: 3, c9: 3, c10: 0, c11: 0, c12: 0,
      c13: 0, c14: 0, c15: 0, c16: 0, c17: 0, c18: 0
    }
  },
  {
    id: "TV11",
    name: "Vũ Ngọc Hiếu",
    role: "Contributor",
    roleLevel: "Contributor",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    department: "Nhóm Nghiên Cứu Ứng Dụng",
    desiredDirection: "Nâng cao năng lực thuyết trình và làm việc trực tiếp với khách hàng triển khai.",
    commitmentLevel: "Nhiệt huyết, sẵn sàng nhận nhiệm vụ mới",
    evidenceNotes: "Thực hiện demo sản phẩm trôi chảy trước đoàn khách tham quan Lab.",
    scores: {
      c1: 5, c2: 4, c3: 6, c4: 5, c5: 6, c6: 6,
      c7: 7, c8: 0, c9: 0, c10: 6, c11: 0, c12: 0,
      c13: 0, c14: 0, c15: 0, c16: 0, c17: 0, c18: 0
    }
  },
  {
    id: "TV12",
    name: "Nguyễn Thức",
    role: "Learning Member",
    roleLevel: "Learning",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    department: "Tổ Đào Tạo Cơ Bản",
    desiredDirection: "Xây dựng nền tảng tư duy lập trình vững vàng và kỹ năng làm việc nhóm.",
    commitmentLevel: "Cam kết học tập theo lộ trình",
    evidenceNotes: "Nộp bài thực hành đúng hạn, tích cực hỏi han khi gặp khó khăn.",
    scores: {
      c1: 1, c2: 1, c3: 1, c4: 2, c5: 2, c6: 1,
      c7: 5, c8: 0, c9: 0, c10: 0, c11: 0, c12: 0,
      c13: 0, c14: 0, c15: 0, c16: 0, c17: 0, c18: 0
    }
  },
  {
    id: "TV13",
    name: "Trần Nhật Quân",
    role: "Contributor",
    roleLevel: "Contributor",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80",
    department: "Nhóm Lập Trình Backend",
    desiredDirection: "Nâng cao năng lực xử lý database quy mô lớn và tối ưu latency hệ thống.",
    commitmentLevel: "Tập trung cao độ khi vào ca",
    evidenceNotes: "Tối ưu hóa các query báo cáo chấm công giúp giảm tải đáng kể cho server.",
    scores: {
      c1: 4, c2: 4, c3: 3, c4: 2, c5: 2, c6: 1,
      c7: 7, c8: 6, c9: 7, c10: 0, c11: 0, c12: 5,
      c13: 0, c14: 0, c15: 0, c16: 0, c17: 0, c18: 0
    }
  },
  {
    id: "TV14",
    name: "Lưu Nguyễn Trí Dũng",
    role: "Learning Member",
    roleLevel: "Learning",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    department: "Tổ Học Viên Tiềm Năng",
    desiredDirection: "Tiếp cận nghiên cứu AI và rèn luyện kỹ năng viết code chuẩn chỉnh.",
    commitmentLevel: "Nhiệt tình tham gia các buổi sinh hoạt chuyên môn",
    evidenceNotes: "Đang tham gia khóa huấn luyện kỹ năng mềm và Git căn bản của Lab.",
    scores: {
      c1: 3, c2: 2, c3: 2, c4: 3, c5: 3, c6: 2,
      c7: 4, c8: 4, c9: 3, c10: 2, c11: 2, c12: 3,
      c13: 3, c14: 2, c15: 2, c16: 3, c17: 2, c18: 2
    }
  },
  {
    id: "TV15",
    name: "Nguyễn Vũ Hoàng Long",
    role: "Learning Member",
    roleLevel: "Learning",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    department: "Tổ Trực Kỹ Thuật & Vận Hành",
    desiredDirection: "Làm chủ quy trình vận hành ca trực Lab và triển khai ứng dụng Kiosk thông minh.",
    commitmentLevel: "Rất cao, đảm bảo trực ca đầy đủ không vắng",
    evidenceNotes: "Thành viên tích cực trong việc kiểm tra thiết bị phần cứng phòng máy và hỗ trợ người dùng.",
    scores: {
      c1: 4, c2: 3, c3: 3, c4: 4, c5: 5, c6: 3,
      c7: 5, c8: 5, c9: 4, c10: 3, c11: 4, c12: 4,
      c13: 3, c14: 3, c15: 3, c16: 4, c17: 3, c18: 3
    }
  },
  {
    id: "TV16",
    name: "Nguyễn Nhân Đức",
    role: "Learning Member",
    roleLevel: "Learning",
    avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
    department: "Tổ Học Viên Mới",
    desiredDirection: "Rèn luyện tư duy phân tích dữ liệu và phương pháp nghiên cứu khoa học.",
    commitmentLevel: "Cố gắng học hỏi theo hướng dẫn của mentor",
    evidenceNotes: "Đã hoàn thành bài tập tổng kết lý thuyết về các kiến trúc mạng nơ-ron cơ bản.",
    scores: {
      c1: 2, c2: 2, c3: 2, c4: 3, c5: 3, c6: 2,
      c7: 4, c8: 3, c9: 3, c10: 2, c11: 2, c12: 2,
      c13: 3, c14: 2, c15: 2, c16: 3, c17: 2, c18: 2
    }
  }
];

/**
 * Tính toán điểm tổng, điểm trung bình từng nhóm và điểm toàn bộ
 */
export function calculateMemberStats(scores) {
  // Nhóm 1: c1 -> c6
  const g1Keys = ["c1", "c2", "c3", "c4", "c5", "c6"];
  const g1Vals = g1Keys.map(k => Number(scores[k]) || 0);
  const g1Evaluated = g1Vals.filter(v => v > 0);
  const g1Sum = g1Vals.reduce((a, b) => a + b, 0);
  const g1Avg = g1Evaluated.length > 0 ? (g1Sum / g1Evaluated.length) : 0;

  // Nhóm 2: c7 -> c12
  const g2Keys = ["c7", "c8", "c9", "c10", "c11", "c12"];
  const g2Vals = g2Keys.map(k => Number(scores[k]) || 0);
  const g2Evaluated = g2Vals.filter(v => v > 0);
  const g2Sum = g2Vals.reduce((a, b) => a + b, 0);
  const g2Avg = g2Evaluated.length > 0 ? (g2Sum / g2Evaluated.length) : 0;

  // Nhóm 3: c13 -> c18
  const g3Keys = ["c13", "c14", "c15", "c16", "c17", "c18"];
  const g3Vals = g3Keys.map(k => Number(scores[k]) || 0);
  const g3Evaluated = g3Vals.filter(v => v > 0);
  const g3Sum = g3Vals.reduce((a, b) => a + b, 0);
  const g3Avg = g3Evaluated.length > 0 ? (g3Sum / g3Evaluated.length) : 0;

  // Toàn bộ 18 tiêu chí
  const allVals = [...g1Vals, ...g2Vals, ...g3Vals];
  const allEvaluated = allVals.filter(v => v > 0);
  const grandTotal = allVals.reduce((a, b) => a + b, 0);
  const grandAvg = allEvaluated.length > 0 ? (grandTotal / allEvaluated.length) : 0;

  return {
    group1: { sum: g1Sum, avg: Number(g1Avg.toFixed(1)), count: g1Evaluated.length, max: 60 },
    group2: { sum: g2Sum, avg: Number(g2Avg.toFixed(1)), count: g2Evaluated.length, max: 60 },
    group3: { sum: g3Sum, avg: Number(g3Avg.toFixed(1)), count: g3Evaluated.length, max: 60 },
    total: grandTotal,
    overallAvg: Number(grandAvg.toFixed(1)),
    evaluatedCount: allEvaluated.length,
    isComplete: allEvaluated.length === 18
  };
}
