"""Mock adapter boundary for a future hospital HIS/EMR integration."""


class HospitalHisAdapter:
    async def exchange_records(self, provider_id: str) -> None:
        raise NotImplementedError("Hospital HIS integration is intentionally not enabled in Phase 0")
