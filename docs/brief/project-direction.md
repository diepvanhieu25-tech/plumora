# **Tài liệu Định hướng Phát triển: Hệ thống Quản lý và Khuyến nghị Lộ trình Học Cá nhân hóa ứng dụng Học tăng cường (RL)**

Tài liệu này quy hoạch toàn bộ vòng đời phát triển của dự án, đi từ phạm vi cốt lõi phục vụ Đồ án Tốt nghiệp (Phase 1 \- MVP) cho đến các bản nâng cấp mở rộng tính năng thực tế (Phase 2\) và tầm nhìn quy mô công nghiệp (Phase 3).

## **Giai đoạn 1: MVP (Minimum Viable Product) – Trọng tâm Đồ án Tốt nghiệp**

Đây là giới hạn phạm vi an toàn, đảm bảo tính khả thi cao nhất để hoàn thành đồ án đúng hạn trong khi vẫn phô diễn được năng lực áp dụng trí tuệ nhân tạo vào kỹ nghệ phần mềm.

### **1\. Phạm vi Kiến thức & Hệ thống Đánh giá**

* **Domain Kiến thức:** Giới hạn ở 12-15 khái niệm cốt lõi của Backend Developer (Internet, HTTP, OS, Cơ sở dữ liệu Relational/NoSQL, RESTful API, Security cơ bản).  
* **Định dạng Bài tập:** Trắc nghiệm khách quan (MCQ \- Multiple Choice Questions) với 3-5 câu hỏi mỗi bài học.  
* **Tiêu chí Đánh giá:** Điểm sàn (Pass threshold) \$\\ge 75\\%\$ để được ghi nhận thông thạo Node kiến thức.

### **2\. Lõi AI & Xử lý Dữ liệu**

* **Môi trường Huấn luyện:** Code một **Student Simulator** bằng thư viện gymnasium (Python) để giả lập hàng chục ngàn hồ sơ học viên ảo với các hệ số tiếp thu khác nhau.  
* **Thuật toán Khuyến nghị:** Sử dụng **Deep Q-Network (DQN)** thông qua thư viện *Stable-Baselines3* để AI tự học cách đề xuất bài học tiếp theo dựa trên mảng vector trạng thái của học viên.  
* **Hàm Phần thưởng (Reward):** Tính toán ngay lập tức sau mỗi bài trắc nghiệm (Điểm cộng khi qua bài mới, điểm phạt khi bắt làm lại bài quá dễ hoặc bài vượt rào chưa có kiến thức nền).

### **3\. Kiến trúc Phần mềm (Modular Monolith)**

* **Backend:** FastAPI (Python) – Xử lý nhanh gọn các request API và dễ dàng import các model Machine Learning (PyTorch, Stable-Baselines3).  
* **Frontend:** React.js / Next.js (Thiết kế giao diện Mini-LMS với màn hình Map lộ trình, Màn hình học lý thuyết, và Khung làm Quiz).  
* **Database:** PostgreSQL (lưu trữ thông tin User, Khóa học, Bài test) và Redis (lưu trữ State theo thời gian thực để model DQN dự đoán nhanh).

## **Giai đoạn 2: Nâng cấp Trải nghiệm và Tối ưu (Post-MVP)**

Giai đoạn này tập trung vào việc biến hệ thống từ một "đồ án sinh viên" thành một sản phẩm EdTech thực tiễn, sẵn sàng phục vụ người dùng thật, bổ sung các chức năng mà người học lập trình kỳ vọng.

### **1\. Tích hợp Đánh giá Thực hành (Code Submission)**

* **Tính năng:** Vượt ra ngoài MCQ, hệ thống cho phép học viên gõ code trực tiếp trên trình duyệt (VD: viết một hàm truy vấn SQL hoặc tạo một endpoint GET đơn giản).  
* **Kỹ thuật:** Xây dựng một Auto-grader Service chạy mã nguồn của user trong các Docker Container dùng một lần (Isolated Sandbox) để chấm điểm tự động.  
* **Giao tiếp với AI:** Hệ thống tổng hợp điểm từ bộ test case của Auto-grader để tính toán Reward cho model DQN, thay vì chỉ dựa vào câu hỏi trắc nghiệm.

### **2\. Ôn tập Ngắt quãng (Spaced Repetition)**

* **Tính năng:** Thuật toán AI không chỉ hướng dẫn người dùng "tiến lên", mà còn biết khi nào người dùng sắp "quên" kiến thức cũ để chèn bài ôn tập vào lộ trình học.  
* **Kỹ thuật:** Áp dụng đường cong lãng quên Ebbinghaus (Forgetting Curve) vào mảng Vector Trạng thái (State). Điểm thông thạo của một Node sẽ tự động suy giảm theo hàm mũ (${e}^{-t}$) dựa trên số ngày học viên không đụng đến khái niệm đó.

### **3\. Trợ lý Giải đáp Tích hợp (AI Tutor)**

* **Tính năng:** Khi học viên làm sai bài trắc nghiệm, hệ thống không chỉ báo "Sai" mà sẽ xuất hiện một khung chat giải thích chi tiết tại sao phương án đó sai.  
* **Kỹ thuật:** Kết nối với các API LLM (như Gemini, GPT-4) và truyền ngữ cảnh (Context) gồm câu hỏi \+ đáp án học viên đã chọn để sinh ra lời giải thích tự nhiên, cá nhân hóa.

## **Giai đoạn 3: Scale & Enterprise (Mở rộng Quy mô Công nghiệp)**

Đây là cấu trúc dài hạn nếu dự án được thương mại hóa hoặc kêu gọi vốn startup. Hệ thống phải giải quyết bài toán hàng trăm ngàn người dùng đồng thời, trên nhiều lĩnh vực khác nhau.

### **1\. Chuyển đổi Kiến trúc sang Microservices**

* **Tách Service:** Cấu trúc Modular Monolith được phá vỡ thành các dịch vụ độc lập: User Service, Course & Content Service, Assessment & Grader Service, và lõi Recommendation AI Service.  
* **Hạ tầng:** Container hóa toàn bộ hệ thống (Docker, Kubernetes) để auto-scale độc lập phần lõi AI mỗi khi lượng request xin gợi ý bài học tăng đột biến.

### **2\. Thuật toán Học tăng cường Nâng cao**

* **Từ Rời rạc sang Liên tục:** Nếu nội dung học bùng nổ lên hàng ngàn bài giảng, không gian hành động rời rạc (Discrete Action Space) của DQN sẽ bị nghẽn (Curse of Dimensionality). Hệ thống sẽ chuyển sang dùng các thuật toán **PPO (Proximal Policy Optimization)** hoặc **Actor-Critic** để xử lý không gian trạng thái khổng lồ.  
* **Online Learning:** Bắt đầu sử dụng dữ liệu từ người học thật (Thay vì chỉ dùng Student Simulator) để Fine-tune (tinh chỉnh) mô hình RL theo thời gian thực (Online RL), kèm theo cơ chế Human-in-the-Loop để giáo viên kiểm duyệt các đường đi kỳ lạ do AI tạo ra.

### **3\. Đa dạng hóa Domain (Đa lĩnh vực & Ngôn ngữ)**

* **Tính năng:** Khả năng định nghĩa các cây kỹ năng (Knowledge Graph) mới hoàn toàn (Data Scientist, Frontend, DevOps) hoặc dịch thuật tự động, không cần viết lại mã nguồn.  
* **Kỹ thuật AI:** Thay thế mạng perceptron truyền thống (MLP) trong model DQN bằng **Graph Neural Networks (GNN)**. GNN có khả năng đọc hiểu trực tiếp cấu trúc mạng lưới môn học, giúp AI nhanh chóng làm quen với một lĩnh vực mới mà không cần huấn luyện lại từ đầu.

