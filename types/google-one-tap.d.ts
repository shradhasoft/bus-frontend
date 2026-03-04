/**
 * Type declarations for Google Identity Services (GIS) — One Tap API.
 * @see https://developers.google.com/identity/gsi/web/reference/js-reference
 */

interface GoogleCredentialResponse {
  /** JWT credential string (Google ID token). */
  credential: string;
  /** How the credential was selected. */
  select_by:
    | "auto"
    | "user"
    | "user_1tap"
    | "user_2tap"
    | "btn"
    | "btn_confirm"
    | "btn_add_session"
    | "btn_confirm_add_session"
    | "fedcm"
    | "fedcm_auto";
  /** Client ID used for the request. */
  clientId?: string;
}

interface GooglePromptNotification {
  /** Returns the moment type as a string. */
  getMomentType(): "display" | "skipped" | "dismissed";
  /** Returns the reason for skipped or dismissed moments. */
  getSkippedReason?():
    | "auto_cancel"
    | "user_cancel"
    | "tap_outside"
    | "issuing_failed"
    | undefined;
  getDismissedReason?():
    | "credential_returned"
    | "cancel_called"
    | "flow_restarted"
    | undefined;
  /** Whether the prompt is displayed. */
  isDisplayed(): boolean;
  /** Whether the prompt is not displayed. */
  isNotDisplayed(): boolean;
  /** Whether the prompt is skipped. */
  isSkippedMoment(): boolean;
  /** Whether the prompt is dismissed. */
  isDismissedMoment(): boolean;
}

interface GoogleIdConfiguration {
  /** Your Google API client ID. */
  client_id: string;
  /** Callback invoked when a credential is returned. */
  callback?: (response: GoogleCredentialResponse) => void;
  /** The Sign In With Google button UX flow. */
  ux_mode?: "popup" | "redirect";
  /** Enable automatic sign-in. */
  auto_select?: boolean;
  /** URI for redirect mode. */
  login_uri?: string;
  /** Cancel the prompt on outside tap. */
  cancel_on_tap_outside?: boolean;
  /** Notification callback for prompt display status. */
  prompt_parent_id?: string;
  /** Nonce for ID token replay prevention. */
  nonce?: string;
  /** Use FedCM for the One Tap flow. */
  use_fedcm_for_prompt?: boolean;
  /** The URL of the intermediate iframe. */
  intermediate_iframe_close_callback?: () => void;
  /** Log level. */
  log_level?: "debug" | "info" | "warn";
  /** ITP support. */
  itp_support?: boolean;
}

interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void;
  prompt(
    momentListener?: (notification: GooglePromptNotification) => void,
  ): void;
  cancel(): void;
  disableAutoSelect(): void;
  revoke(
    hint: string,
    callback?: (response: { successful: boolean; error?: string }) => void,
  ): void;
}

interface GoogleAccounts {
  id: GoogleAccountsId;
}

interface Google {
  accounts: GoogleAccounts;
}

interface Window {
  google?: Google;
}
