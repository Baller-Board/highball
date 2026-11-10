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
  if (error.code === "23505" && msg.includes("crews_slug_key"))
    return "That crew link is taken. Pick another.";
  if (error.code === "23505" && msg.includes("crews_name_key"))
    return "A crew with that name is already registered.";
  if (error.code === "23514" && msg.includes("not_ancient"))
    return "Dates before 1990 can't be logged.";
  if (error.code === "23514" && msg.includes("handle_clean"))
    return "Camp names can't start or end with a space or contain / \\ % ? or #.";
  if (error.code === "23514" && msg.includes("crew_website_shape"))
    return "Website needs to start with https://";
  // Errors raised by our own database functions already read well.
  if (error.code === "P0001" || error.code === "P0002" || error.code === "22023") return msg;
  if (error.code === "42501")
    return msg && !msg.startsWith("permission denied") && !msg.includes("row-level security")
      ? msg
      : "You don't have permission to change that.";
  return msg || "Something went wrong. Try again.";
}

// ilike treats % and _ as wildcards. Escape them so a case-insensitive
// lookup of "tree_beast" can't also match "tree-beast".
const likeExact = (s) => String(s).replace(/[\\%_]/g, (c) => "\\" + c);

export async function fetchBoard(sortKey = "gnar", { verifiedOnly = false, limit = 200 } = {}) {
  let q = supabase.from("board").select("*");
  if (verifiedOnly) q = q.eq("crew_verified", true);
  const { data, error } = await q
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
    .ilike("handle", likeExact(handle))
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

// ---------- crews ----------

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(readable(error));
  return data;
}

export async function amSiteAdmin(userId) {
  const { data } = await supabase.from("site_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

// Approved crews, plus any you run (so owners can see theirs while pending).
export async function fetchCrews() {
  const { data, error } = await supabase
    .from("crews")
    .select("*, crew_members(count)")
    .eq("crew_members.status", "active")
    .order("name");
  if (error) throw new Error(readable(error));
  return (data || []).map((c) => ({ ...c, members: c.crew_members?.[0]?.count ?? 0 }));
}

export async function fetchCrew(slug) {
  const { data, error } = await supabase.from("crews").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(readable(error));
  return data || null;
}

export async function createCrew(crew) {
  const row = {
    slug: crew.slug,
    name: crew.name,
    base: crew.base || null,
    country: crew.country || null,
    website: crew.website || null,
    about: crew.about || null,
  };
  const { error } = await supabase.from("crews").insert(row);
  if (error) throw new Error(readable(error));
}

export async function updateCrew(id, crew) {
  const { error } = await supabase
    .from("crews")
    .update({
      name: crew.name,
      base: crew.base || null,
      country: crew.country || null,
      website: crew.website || null,
      about: crew.about || null,
    })
    .eq("id", id);
  if (error) throw new Error(readable(error));
}

// Owner and checkers, with camp names where they have a profile.
export async function fetchStaff(crewId) {
  const { data, error } = await supabase.from("crew_staff").select("user_id, role").eq("crew_id", crewId);
  if (error) throw new Error(readable(error));
  const ids = (data || []).map((s) => s.user_id);
  const names = ids.length
    ? (await supabase.from("planters").select("user_id, handle").in("user_id", ids)).data || []
    : [];
  return (data || []).map((s) => ({
    ...s,
    handle: names.find((n) => n.user_id === s.user_id)?.handle || null,
  }));
}

// Members of a crew (active for everyone; pending too if you're staff),
// each joined to their board row.
export async function fetchRoster(crewId) {
  const { data, error } = await supabase
    .from("crew_members")
    .select("id, status, requested_at, decided_at, planter_id")
    .eq("crew_id", crewId)
    .in("status", ["active", "pending"]);
  if (error) throw new Error(readable(error));
  const ids = (data || []).map((m) => m.planter_id);
  if (!ids.length) return [];
  const { data: rows, error: e2 } = await supabase.from("board").select("*").in("id", ids);
  if (e2) throw new Error(readable(e2));
  return data
    .map((m) => ({ ...m, planter: rows.find((r) => r.id === m.planter_id) }))
    .filter((m) => m.planter)
    .sort((a, b) => b.planter.gnar - a.planter.gnar);
}

// Days from active members that haven't been looked at yet.
export async function fetchReviewQueue(planterIds) {
  if (!planterIds.length) return [];
  const { data, error } = await supabase
    .from("days")
    .select("*")
    .in("planter_id", planterIds)
    .is("verdict", null)
    .order("date", { ascending: false })
    .limit(300);
  if (error) throw new Error(readable(error));
  return data || [];
}

// Your memberships and staff roles, for the camp page.
export async function fetchMyCrews(userId, planterId) {
  const [staff, members] = await Promise.all([
    supabase.from("crew_staff").select("role, crews(id, slug, name, status)").eq("user_id", userId),
    planterId
      ? supabase.from("crew_members").select("id, status, crews(id, slug, name, status)").eq("planter_id", planterId)
      : Promise.resolve({ data: [] }),
  ]);
  if (staff.error) throw new Error(readable(staff.error));
  if (members.error) throw new Error(readable(members.error));
  return {
    staff: (staff.data || []).filter((s) => s.crews),
    members: (members.data || []).filter((m) => m.crews && m.status !== "left"),
  };
}

export async function fetchCrewNames(ids) {
  if (!ids.length) return {};
  const { data } = await supabase.from("crews").select("id, name, slug").in("id", ids);
  return Object.fromEntries((data || []).map((c) => [c.id, c]));
}

export async function fetchPendingCrews() {
  const { data, error } = await supabase
    .from("crews")
    .select("*")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw new Error(readable(error));
  return data || [];
}

export const requestToJoin = (crewId) => rpc("request_to_join", { p_crew: crewId });
export const leaveCrew = (crewId) => rpc("leave_crew", { p_crew: crewId });
export const decideMember = (memberId, status) => rpc("decide_member", { p_member: memberId, p_status: status });
export const addChecker = (crewId, handle) => rpc("add_checker", { p_crew: crewId, p_handle: handle });
export const removeChecker = (crewId, userId) => rpc("remove_checker", { p_crew: crewId, p_user: userId });
export const reviewCrew = (crewId, status) => rpc("review_crew", { p_crew: crewId, p_status: status });
export const judgeDays = (crewId, dayIds, verdict, note) =>
  rpc("judge_days", { p_crew: crewId, p_days: dayIds, p_verdict: verdict, p_note: note || null });
