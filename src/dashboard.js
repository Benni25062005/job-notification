import { searchProfile } from './config.js';

export function dashboardPayload(snapshot, sent, notificationsEnabled, profile = searchProfile) {
  return {
    searchedAt: snapshot?.searchedAt || null,
    warnings: snapshot?.warnings || [],
    jobs: snapshot?.jobs || [],
    email: sent ? { status: 'accepted', count: sent.count, completedAt: sent.completedAt } : { status: 'not-confirmed' },
    notificationsEnabled,
    profile: { timeZone: profile.timeZone, areas: profile.areas, maxDaysOld: profile.maxDaysOld, skills: profile.skills },
  };
}
