"""Dynamic Vietnamese Pedagogical Rationale Builder for Web Client recommendations."""

from __future__ import annotations

from collections.abc import Sequence

from plumora_rl.domain import EbbinghausMemoryModel, LearningMode

from app.shared.contracts.dtos import ConceptNodeDTO, UserNodeCompetencyDTO

_ESTIMATED_MINUTES: dict[LearningMode, int] = {
    LearningMode.LEARN_NEW: 10,
    LearningMode.DEEP_PROBE: 8,
    LearningMode.CODE_PRACTICE: 12,
    LearningMode.SPACED_REVIEW: 3,
}


class PedagogicalRationaleBuilder:
    """Generates learner-friendly Vietnamese pedagogical rationale without ML/RL jargon."""

    @staticmethod
    def build_reason(
        *,
        target_node: ConceptNodeDTO,
        mode: LearningMode,
        all_nodes: Sequence[ConceptNodeDTO],
        comp_map: dict[str, UserNodeCompetencyDTO],
        retention: float,
    ) -> str:
        """Build a concrete, personalized Vietnamese rationale for the recommended step."""
        title_by_slug = {n.concept_slug: n.title for n in all_nodes}
        comp = comp_map.get(target_node.concept_slug)
        depth_pct = round((comp.depth_level_norm if comp else 0.0) * 100)
        stability_s = comp.stability_s if comp else EbbinghausMemoryModel.INITIAL_STABILITY_DAYS
        est_min = _ESTIMATED_MINUTES.get(mode, 10)

        # Find downstream nodes unlocked directly by target_node
        downstream = [
            n.title
            for n in all_nodes
            if target_node.concept_slug in n.prerequisites
        ]
        prereq_titles = [title_by_slug.get(p, p) for p in target_node.prerequisites]

        parts: list[str] = []

        if mode == LearningMode.SPACED_REVIEW:
            ret_pct = round(retention * 100)
            next_s = round(EbbinghausMemoryModel.update_stability(stability_s, 0.9, passed=True), 1)
            parts.append(
                f"Độ nhớ ước tính của «{target_node.title}» đang giảm còn {ret_pct}% (< 60%). "
                f"Chỉ cần ôn tập nhanh (~{est_min} phút) để củng cố độ bền trí nhớ từ "
                f"{stability_s:.1f} ngày lên ~{next_s:.1f} ngày."
            )
        elif mode == LearningMode.LEARN_NEW:
            if prereq_titles:
                prereq_str = ", ".join(prereq_titles[:2])
                parts.append(
                    f"Bạn đã hoàn thành nền tảng {prereq_str} nên «{target_node.title}» đã sẵn sàng."
                )
            else:
                parts.append(
                    f"«{target_node.title}» là khái niệm nền tảng gốc Tầng {target_node.tier}, "
                    f"thích hợp để bắt đầu ngay."
                )
            parts.append(
                f"Hãy đọc Playbook lý thuyết và làm bài kiểm tra nền tảng (~{est_min} phút)."
            )
        elif mode == LearningMode.DEEP_PROBE:
            parts.append(
                f"Bạn đã nắm mức cơ bản ({depth_pct}%) của «{target_node.title}». "
                f"Hãy đào sâu qua tình huống thực tế và đánh đổi kiến trúc (~{est_min} phút) "
                f"để đạt chuẩn Hiểu bản chất (75%)."
            )
        else:  # CODE_PRACTICE
            parts.append(
                f"Bạn đã hiểu bản chất lý thuyết ({depth_pct}%) của «{target_node.title}». "
                f"Hãy hoàn thành thử thách sửa lỗi trên Code Sandbox (~{est_min} phút) "
                f"để đạt mức Làm chủ 100%."
            )

        if downstream and mode != LearningMode.SPACED_REVIEW:
            preview = ", ".join(downstream[:2])
            extra = f" và {len(downstream) - 2} chủ đề khác" if len(downstream) > 2 else ""
            parts.append(f"Hoàn thành chủ đề này sẽ mở khóa: {preview}{extra}.")

        if target_node.is_shared:
            parts.append("Kiến thức liên thông: điểm năng lực được tự động đồng bộ sang các lộ trình khác.")

        return " ".join(parts)

    @staticmethod
    def build_decision_factors(
        *,
        target_node: ConceptNodeDTO,
        mode: LearningMode,
        all_nodes: Sequence[ConceptNodeDTO],
        comp_map: dict[str, UserNodeCompetencyDTO],
        retention: float,
    ) -> list[str]:
        """Return 2-3 concise, learner-friendly adaptive factors explaining why RL prioritized this step."""
        factors: list[str] = []
        comp = comp_map.get(target_node.concept_slug)
        depth_pct = round((comp.depth_level_norm if comp else 0.0) * 100)
        downstream = [n.title for n in all_nodes if target_node.concept_slug in n.prerequisites]

        if mode == LearningMode.SPACED_REVIEW:
            factors.append(f"Độ bền trí nhớ đang giảm còn {round(retention * 100)}% (ngưỡng nhắc ôn 60%)")
            factors.append("Ôn tập 3 phút giúp kéo dài chu kỳ ghi nhớ dài hạn")
        elif mode == LearningMode.LEARN_NEW:
            factors.append(f"Phù hợp mức năng lực hiện tại ({depth_pct}%) và đã đủ điều kiện tiên quyết")
            if downstream:
                factors.append(f"Mở khóa trực tiếp {len(downstream)} chủ đề chuyên sâu tiếp theo")
        elif mode == LearningMode.DEEP_PROBE:
            factors.append(f"Đang ở mức {depth_pct}% — tối ưu nhất để nâng lên chuẩn Hiểu bản chất (75%)")
            if downstream:
                factors.append(f"Đạt 75% sẽ mở khóa: {', '.join(downstream[:2])}")
        else:
            factors.append(f"Đã đạt lý thuyết ({depth_pct}%), chỉ còn bước thực hành Code để chạm 100% Làm chủ")

        if target_node.is_shared:
            factors.append("Chủ đề liên thông: kết quả tự đồng bộ sang các chuyên ngành khác")

        return factors[:3]

    @staticmethod
    def goal_summary_for_mode(mode: LearningMode) -> tuple[int, str]:
        """Return (estimated_minutes, concise goal summary) for planned path preview."""
        est = _ESTIMATED_MINUTES.get(mode, 10)
        if mode == LearningMode.SPACED_REVIEW:
            return est, "Củng cố trí nhớ & kéo dài chu kỳ quên"
        if mode == LearningMode.LEARN_NEW:
            return est, "Nắm mô hình tư duy qua Playbook 5 phần"
        if mode == LearningMode.DEEP_PROBE:
            return est, "Nâng bậc lên Hiểu bản chất (75%)"
        return est, "Hoàn thiện thực hành Code đạt Làm chủ (100%)"
