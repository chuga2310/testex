import React, { useState } from 'react';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSuccess();
  };

  return (
    <form data-test="login-form" onSubmit={handleSubmit}>
      <h1>Login</h1>
      <input
        data-testid="login-email-input"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Email address"
        placeholder="Email"
      />
      <input
        data-testid="login-password-input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Password"
        placeholder="Password"
      />
      <button data-testid="login-submit-button" type="submit">
        Sign In
      </button>
      <a href="/forgot-password" data-test="login-forgot-password-link">
        Forgot password?
      </a>
    </form>
  );
}

export default LoginForm;
