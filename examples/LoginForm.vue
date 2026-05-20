<template>
  <div data-test="login-form-container">
    <h1>Login</h1>
    <form data-test="login-form" @submit.prevent="handleSubmit">
      <input
        data-testid="login-email-input"
        type="email"
        v-model="email"
        placeholder="Email"
      />
      <input
        data-testid="login-password-input"
        type="password"
        v-model="password"
        placeholder="Password"
      />
      <button data-test="login-submit-btn" type="submit" @click="handleSubmit">
        Login
      </button>
    </form>
    <div data-test="login-error" v-if="error">{{ error }}</div>
  </div>
</template>

<script>
export default {
  name: 'LoginForm',
  data() {
    return {
      email: '',
      password: '',
      error: null
    }
  },
  methods: {
    async handleSubmit() {
      try {
        await this.$router.push('/dashboard')
      } catch (e) {
        this.error = e.message
      }
    }
  }
}
</script>
