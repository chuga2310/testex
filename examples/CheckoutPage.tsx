import React, { useState } from 'react';

export function CheckoutPage() {
  const [step, setStep] = useState(1);

  return (
    <div data-test="checkout-page">
      <h1>Checkout</h1>
      <section data-test="checkout-cart-summary">
        <h2>Order Summary</h2>
        <button
          data-testid="checkout-remove-item-button"
          onClick={() => console.log('remove')}
          aria-label="Remove item"
        >
          Remove
        </button>
      </section>
      <section data-test="checkout-shipping-section">
        <input
          data-testid="checkout-shipping-name-input"
          type="text"
          aria-label="Full name"
          placeholder="Full name"
        />
        <input
          data-testid="checkout-shipping-address-input"
          type="text"
          aria-label="Street address"
          placeholder="Address"
        />
      </section>
      <button
        data-testid="checkout-submit-button"
        onClick={() => setStep(2)}
        aria-label="Place order"
      >
        Place Order
      </button>
    </div>
  );
}

export default CheckoutPage;
