# Shopify Checkout Extension with Encrypted Pricing

This project provides a Shopify checkout extension and a Shopify Function (written in Rust) to automatically apply a discount if the total price of cart items reaches a specified threshold in the shop's currency. The extension fetches product prices, calculates the total price of cart items, encrypts this total price, and adds it as a cart attribute. The Rust function decrypts the total price and applies a discount if it exceeds the threshold.

## Table of Contents

- [Setup and Configuration](#setup-and-configuration)
- [Usage](#usage)
- [Shopify Extension](#shopify-extension)
- [Rust Function](#rust-function)
- [Environment Variables](#environment-variables)
- [License](#license)

## Setup and Configuration

1. **Start the Development Server**:
    ```sh
    shopify app dev
    ```
    - Follow any prompts to create the app. Once successfully created, stop the server.

2. **Update Encryption Settings**:
    - Update the order discount extension to add your encryption key and IV stored in the `.env` file of the [Encryption Server](../encryption-app).

3. **Update App Configuration**:
    - Modify the app's configuration TOML file (e.g., `shopify.app.*.toml`) to request the `write_discounts` scope.

4. **Enable Network Access**:
    - In your Shopify Partner Dashboard, navigate to the app's API access tab and enable network access for the app under the "Allow network access in checkout and account UI extensions" section.

5. **Deploy Configuration to Shopify**:
    ```sh
    shopify app deploy
    ```

6. **Restart the App**:
    ```sh
    shopify app dev
    ```

7. **Accept New Permissions**:
    - Open your app using the URL provided by the Shopify CLI and accept the new access scope permissions in your store.

8. **Use GraphiQL for Discount Creation**:
    - Open GraphiQL by pressing `g` in the terminal where the server is running.
    - Query your Function's ID, which will be used to create the discount in the next step.

    ```graphql
    {
      shopifyFunctions(first: 5, apiType: "order_discounts") {
        nodes {
          id
          apiType
          title
        }
      }
    }
    ```

9. **Activate the Function**:
    - Create an order discount on the store where you installed your app using the `discountAutomaticAppCreate` mutation.

    ```graphql
    mutation {
      discountAutomaticAppCreate(automaticAppDiscount: {
        title: "{discount_name}",
        functionId: "{order_discount_function_id}",
        startsAt: "{date_discount_is_active_from}",
        combinesWith: {
          productDiscounts: true,
          orderDiscounts: true,
          shippingDiscounts: true
        }
      }) {
        automaticAppDiscount {
          discountId
          title
          status
        }
        userErrors {
          field
          message
        }
      }
    }
    ```

    - Ensure the response includes the ID of the created order discount.
    - If there are any `userErrors`, review the errors, check your mutation and `functionId`, and try again.

## Usage

Once you have completed the setup and configuration, you can preview the Shopify checkout extension to see it in action. Follow these steps:

1. **Preview the Extension**:
   - From the terminal console where your development server is running, press `p` to preview the extension in your browser.
   - This will open a new browser window displaying the extension target, which is a preview of the checkout process.

2. **Test the Discount Application**:
   - Navigate to your storefront and add items to your cart.
   - Ensure that the total price of the items in your cart reaches or exceeds the discount threshold specified in your Rust function.
   - Proceed to the checkout page.

3. **Verify Discount Application**:
   - On the checkout page, observe that the discount is automatically applied to your order if the total price meets the threshold (NB. Threshold is in the shop currency).
   - The discount should be visible in the order summary, reflecting the percentage or amount specified by your Rust function.

## Shopify Extension

### Overview

The Shopify checkout extension is built using React and TypeScript. It integrates with the `@shopify/ui-extensions-react/checkout` library to interact with the Shopify checkout process.

### Key Features

- Fetches product prices from Shopify's API in shop currency.
- Calculates the total price of items in the cart.
- Encrypts the total price using an external encryption service.
- Updates the cart with the encrypted total price.
- Applies discounts based on the decrypted total price.

## Rust Function

### Overview

The Rust function handles decrypting the encrypted total price and applying discounts based on the decrypted value.

### Key Features

- Decrypts the total price using AES-128-CBC.
- Applies a discount if the decrypted total price exceeds a certain threshold.

## Environment Variables

- `ENCRYPTION_KEY`: The encryption key used for AES-128-CBC encryption and decryption (must be 32 hexadecimal characters).
- `ENCRYPTION_IV`: The initialization vector used for AES-128-CBC encryption and decryption (must be 32 hexadecimal characters).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
