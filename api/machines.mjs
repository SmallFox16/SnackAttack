/* Vercel Function: GET /api/machines (Task #6, PBI-38). Logic lives in machines-api.mjs. */
import { handlers } from "./_machine-data.mjs";

export const GET = handlers.getMachines;