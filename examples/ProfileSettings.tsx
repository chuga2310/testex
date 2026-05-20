import React from 'react';

export function ProfileSettings() {
  return (
    <div data-testid="profile-page">
      <h1>Profile Settings</h1>
      <form data-test="profile-form" onSubmit={(e) => e.preventDefault()}>
        <input
          data-testid="profile-name-input"
          type="text"
          aria-label="Display name"
          placeholder="Your name"
        />
        <input
          data-testid="profile-email-input"
          type="email"
          aria-label="Email address"
          placeholder="your@email.com"
        />
        <button
          data-testid="profile-save-button"
          type="submit"
          aria-label="Save profile"
        >
          Save Changes
        </button>
        <button
          data-testid="profile-delete-account-button"
          type="button"
          aria-label="Delete account"
        >
          Delete Account
        </button>
      </form>
    </div>
  );
}

export default ProfileSettings;
