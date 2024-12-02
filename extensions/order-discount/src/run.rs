use shopify_function::prelude::*;
use shopify_function::Result;

use aes::Aes128;
use base64::decode as base64_decode;
use block_modes::block_padding::Pkcs7;
use block_modes::{BlockMode, Cbc};
use hex::decode as hex_decode;
use std::str;

// Constants for encryption key and initialization vector (IV)
const ENCRYPTION_KEY: &str = "your_key_here";
const ENCRYPTION_IV: &str = "your_iv_here";

// Define the function target for Shopify
#[shopify_function_target(query_path = "src/run.graphql", schema_path = "schema.graphql")]
fn run(input: input::ResponseData) -> Result<output::FunctionRunResult> {
    // Vector to hold discounts
    let mut discounts = vec![];

    // Get the total price from the cart attribute
    let total_price = input.cart.attribute.and_then(|attr| attr.value);
    eprintln!("encrypted_price: {:?}", total_price);

    // Check if the total price attribute exists
    if let Some(encrypted_value) = total_price {
        // Attempt to decrypt the total price
        match decrypt_aes_128_cbc_base64(
            &encrypted_value,
            ENCRYPTION_KEY,
            ENCRYPTION_IV,
        ) {
            Ok(decrypted) => {
                eprintln!("decrypted: {}", decrypted);
                // Use the decrypted value to create a discount if it exceeds a threshold
                if let Ok(decrypted_value) = decrypted.parse::<f64>() {
                    if decrypted_value > 2000.0 {
                        let discount = output::Discount {
                            value: output::Value::Percentage(output::Percentage {
                                value: Decimal(10.0),
                            }),
                            conditions: Some(vec![]),
                            targets: vec![output::Target::OrderSubtotal(
                                output::OrderSubtotalTarget {
                                    excluded_variant_ids: vec![],
                                },
                            )],
                            message: Some("Minimum spend".to_string()),
                        };
                        discounts.push(discount);
                    }
                } else {
                    eprintln!("Failed to parse decrypted value as f64");
                }
            }
            Err(e) => eprintln!("Failed to decrypt: {}", e),
        }
    } else {
        eprintln!("No total_price attribute found");
    }

    // Return the result with the discounts and discount application strategy
    Ok(output::FunctionRunResult {
        discounts,
        discount_application_strategy: output::DiscountApplicationStrategy::FIRST,
    })
}

// Create an alias for the AES-128-CBC block mode with PKCS7 padding
type Aes128Cbc = Cbc<Aes128, Pkcs7>;

/**
 * Decrypts data encrypted with AES-128-CBC and encoded in base64
 * @param encrypted_base64 - The base64-encoded encrypted data
 * @param key_hex - The hex-encoded encryption key
 * @param iv_hex - The hex-encoded initialization vector
 * @returns The decrypted data as a string
 */
fn decrypt_aes_128_cbc_base64(
    encrypted_base64: &str,
    key_hex: &str,
    iv_hex: &str,
) -> std::result::Result<String, Box<dyn std::error::Error>> {
    // Decode the base64-encoded encrypted data
    let encrypted_data = base64_decode(encrypted_base64)?;

    // Decode the hex-encoded key and IV
    let key = hex_decode(key_hex)?;
    let iv = hex_decode(iv_hex)?;

    // Create the AES-128-CBC cipher instance
    let cipher = Aes128Cbc::new_from_slices(&key, &iv)?;

    // Decrypt the data
    let decrypted_data = cipher.decrypt_vec(&encrypted_data)?;

    // Convert the decrypted data to a string (if it's UTF-8 encoded)
    let decrypted_string = str::from_utf8(&decrypted_data)?;

    Ok(decrypted_string.to_string())
}

// Unit tests for the function
#[cfg(test)]
mod tests {
    use super::*;
    use shopify_function::{run_function_with_input, Result};

    // Test to ensure the result contains no discounts when no total price is provided
    #[test]
    fn test_result_contains_no_discounts() -> Result<()> {
        use run::output::*;

        let result = run_function_with_input(
            run,
            r#"
                {
                    "discountNode": {
                        "metafield": null
                    }
                }
            "#,
        )?;
        let expected = FunctionRunResult {
            discounts: vec![],
            discount_application_strategy: DiscountApplicationStrategy::FIRST,
        };

        assert_eq!(result, expected);
        Ok(())
    }
}
