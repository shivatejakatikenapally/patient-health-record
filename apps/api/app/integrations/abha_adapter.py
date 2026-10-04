"""Mock adapter boundary for a future ABHA/ABDM integration."""


class AbhaAdapter:
    async def verify_reference(self, reference_id: str) -> bool:
        raise NotImplementedError("ABHA integration is intentionally not enabled in Phase 0")
