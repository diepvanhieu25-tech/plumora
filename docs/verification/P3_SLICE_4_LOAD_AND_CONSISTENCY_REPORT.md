# Báo cáo Kiểm định Độ nhất quán Rubric & Đo tải Cụm 4 Microservices (`P3-SLICE-4` — Việc 4.1)

- **Ngày thực hiện:** 2026-11-19
- **Nhánh:** `feat/p3-slice-3-microservices-online-rl`
- **Tệp dữ liệu gốc:** [`docs/verification/artifacts/load_20vu_report.json`](artifacts/load_20vu_report.json)
- **Script thực thi:** [`scripts/benchmark_p3_slice4.py`](../../scripts/benchmark_p3_slice4.py)

---

## 1. Kiểm định Độ nhất quán Chấm Rubric (`DeterministicRubricGrader` vs Biểu điểm Tham chiếu)

| Chỉ số Kiểm định | Kết quả Đo được |
| --- | --- |
| Tổng số câu hỏi Tầng 3–5 có Rubric | `66` câu (22 khái niệm $\times$ 3 tầng sâu) |
| Tổng số mẫu câu trả lời kiểm thử (Đạt / Trung bình / Yếu) | `198` mẫu |
| Tỷ lệ đồng thuận Đạt / Chưa đạt (`>= 0.75`) | **`100.0%` (`1.0`)** |
| Sai số tuyệt đối trung bình (`MAE`) | **`0.0833`** |
| Tương quan Pearson (`r`) | **`0.9608`** |

---

## 2. Kết quả Benchmark Chịu tải 20 Concurrent Users (`60.19s`) trên Cụm 4 Microservices + API Gateway

Cấu hình cụm thực nghiệm trực tiếp: `user-auth-service` (`8001`), `content-kg-service` (`8002`), `assessment-grader-service` (`8003`), `recommendation-ai-service` (`8004`) đứng sau `api-gateway` (`8000` với HTTP keep-alive connection pool), kết nối PostgreSQL 16 và Redis 7 thật.

| Chỉ số Đo lường (`NFR` Mục 10.4 `docs/spec.md`) | Ngưỡng Yêu cầu | Kết quả Thực tế | Trạng thái |
| --- | --- | --- | --- |
| Số người dùng đồng thời (`Concurrent VUs`) | `20 VU` | `20 VU` (`60.19s`) | **PASS** |
| Tổng số HTTP Requests & Thông lượng | — | `8,796 requests` (`146.14 RPS`) | **PASS** |
| Tỷ lệ lỗi HTTP `5xx` (`NFR-LOAD-20VU`) | `0.0%` | **`0.0%` (`0 / 8,796`)** | **PASS** |
| Độ trễ tổng thể API đọc & khuyến nghị (`p95`) | `< 400.0 ms` | **`232.68 ms`** (`p50 = 101.45 ms`, `p99 = 324.51 ms`) | **PASS** |
| Độ trễ suy luận `GNN-PPO` (`POST /api/v2/recommendations`, `p95`, `NFR-LATENCY-RL`) | `< 250.0 ms` | **`122.81 ms`** (`p50 = 59.48 ms`, `p99 = 169.72 ms`) | **PASS** |
