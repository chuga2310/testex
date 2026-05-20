<script>
  import { goto } from '$app/navigation'
  let email = ''
  let password = ''
  let error = null

  async function handleSubmit() {
    try {
      await goto('/dashboard')
    } catch (e) {
      error = e.message
    }
  }
</script>

<div data-test="login-form-container">
  <h1>Login</h1>
  <form data-test="login-form" on:submit|preventDefault={handleSubmit}>
    <input data-testid="login-email-input" type="email" bind:value={email} />
    <input data-testid="login-password-input" type="password" bind:value={password} />
    <button data-test="login-submit-btn" type="submit" on:click={handleSubmit}>Login</button>
  </form>
  {#if error}
    <div data-test="login-error">{error}</div>
  {/if}
</div>
