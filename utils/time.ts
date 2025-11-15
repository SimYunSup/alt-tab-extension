/**
 * Formats a timestamp into a human-readable "time ago" string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Localized time ago string in Korean
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}초 전`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;

  const years = Math.floor(months / 12);
  return `${years}년 전`;
}

/**
 * Formats milliseconds into a readable remaining time string
 * @param milliseconds - Time in milliseconds
 * @returns Formatted time string (e.g., "5분 30초", "2시간 15분")
 */
export function formatRemainingTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);

  if (seconds < 60) {
    return seconds > 0 ? `${seconds}초` : "종료 중";
  }

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분 ${seconds % 60}초`;
}
