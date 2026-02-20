const ACTIVITY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const VOTE_THRESHOLD = 0.6; // 60%

export interface VoteResult {
  voted: boolean;
  votes: number;
  needed: number;
  threshold: number;
  triggered: boolean;
}

export class VoteManager {
  private activeUsers: Map<string, number> = new Map(); // username → last activity timestamp
  private skipVotes: Set<string> = new Set();

  recordActivity(username: string): void {
    this.activeUsers.set(username, Date.now());
  }

  recordSkipVote(username: string): VoteResult {
    this.recordActivity(username);

    if (this.skipVotes.has(username)) {
      const activeCount = this.getActiveUserCount();
      const needed = Math.ceil(activeCount * VOTE_THRESHOLD);
      return {
        voted: false,
        votes: this.skipVotes.size,
        needed,
        threshold: VOTE_THRESHOLD,
        triggered: false,
      };
    }

    this.skipVotes.add(username);

    const activeCount = this.getActiveUserCount();
    const needed = Math.ceil(activeCount * VOTE_THRESHOLD);
    const triggered = this.skipVotes.size >= needed;

    return {
      voted: true,
      votes: this.skipVotes.size,
      needed,
      threshold: VOTE_THRESHOLD,
      triggered,
    };
  }

  getActiveUserCount(): number {
    const cutoff = Date.now() - ACTIVITY_WINDOW_MS;
    let count = 0;
    for (const [username, timestamp] of this.activeUsers) {
      if (timestamp >= cutoff) {
        count++;
      } else {
        this.activeUsers.delete(username);
      }
    }
    return count;
  }

  getVoteCount(): number {
    return this.skipVotes.size;
  }

  getNeededVotes(): number {
    return Math.ceil(this.getActiveUserCount() * VOTE_THRESHOLD);
  }

  reset(): void {
    this.skipVotes.clear();
  }
}
