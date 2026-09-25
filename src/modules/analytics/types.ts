export interface AnalyticsConfig {
  /** Public PostHog project API key. */
  key: string
  /** PostHog ingestion origin, or a reverse proxy in front of it. */
  host: string
}
