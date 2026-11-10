import { supabase } from "./supabase";

// Postgres error codes we translate into something a planter can act on.
function readable(error) {
  if (!error) return null;
  const msg = error.message || "";
  if (error.code === "23505" && msg.includes("planters_handle_key"))
    return "That camp name is taken. Pick another.";
  if (error.code === "23505" && msg.includes("one_entry_per_day"))
    return "You've already logged that date. Remove the old entry first.";
  if (error.code === "23505" && msg.includes("one_profile_per_person"))
    return "You already have a profile on the board.";
  if (error.code === "23514" && msg.includes("trees"))
    return "Tree count has to be between 1 and 12,000.";
  if (error.code === "23514" && msg.includes("not_in_the_future"))
    return "That date hasn't happened yet.";
  if (error.code === "42501") return "You can only edit your own profile.";
  return msg || "Something went wrong. Try again.";
}

export async function fetchBoard(sortKey = "gnar", limit = 200) {
  const { data, error } = await supabase
    .from("board")
    .select("*")
    .order(sortKey, { ascending: false })
    .order("career_trees", { ascending: false })
    .limit(limit);
  if (error) throw new Error(readable(error));
  return data || [];
}

export async function fetchMine(userId) {
  const { data, error } = await supabase
    .from("board")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(readable(error));
  return data || null;
}

export async function fetchPlanter(handle) {
  const { data, error } = await supabase
    .from("board")
    .select("*")
    .ilike("handle", handle)
    .maybeSingle();
  if (error) throw new Error(readable(error));
  return data || null;
}

export async function fetchDays(planterId) {
  const { data, error } = await supabase
    .from("days")
    .select("*")
    .eq("planter_id", planterId)
    .order("date", { ascending: false });
  if (error) throw new Error(readable(error));
  return data || [];
}

export async function saveProfile(userId, profile, existingId) {
  const row = {
    user_id: userId,
    handle: profile.handle,
    base: profile.base,
    country: profile.country || null,
    crew: profile.crew || null,
    seasons: profile.seasons,
    prior_trees: profile.priorTrees,
    tagline: profile.tagline || null,
  };
  const query = existingId
    ? supabase.from("planters").update(row).eq("id", existingId)
    : supabase.from("planters").insert(row);
  const { error } = await query;
  if (error) throw new Error(readable(error));
}

export async function addDay(planterId, day) {
  const { error } = await supabase.from("days").insert({
    planter_id: planterId,
    date: day.date,
    trees: day.trees,
    terrain: day.terrain,
    block: day.block || null,
    notes: day.notes || null,
  });
  if (error) throw new Error(readable(error));
}

export async function removeDay(id) {
  const { error } = await supabase.from("days").delete().eq("id", id);
  if (error) throw new Error(readable(error));
}

export async function deleteProfile(id) {
  // Days cascade with the profile.
  const { error } = await supabase.from("planters").delete().eq("id", id);
  if (error) throw new Error(readable(error));
}
