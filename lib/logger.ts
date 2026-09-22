import { supabase } from "@/lib/supabase";

export async function logUserActivity(actionType: string, details: string, store: string = "All Stores", userEmail: string = "system@retail.local") {
  try {
    await supabase.from("audit_logs").insert([
      {
        user_email: userEmail,
        action_type: actionType,
        details: details,
        store: store,
      }
    ]);
  } catch (err) {
    console.error("Failed to record audit log:", err);
  }
}