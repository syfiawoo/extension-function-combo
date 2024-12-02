import {
  reactExtension,
  Banner,
  useApi,
  useInstructions,
  useTranslate,
  useApplyAttributeChange,
  useCartLines
} from "@shopify/ui-extensions-react/checkout";
import { useEffect, useState, useCallback } from "react";

// Define types for price and encrypted price response
type Price = {
  amount: string;
  currencyCode: string;
};

type EncryptedPriceResponse = {
  encryptedData: string;
};

// Register the extension to be rendered at the specified target
export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const translate = useTranslate();
  const { query } = useApi();
  const instructions = useInstructions();
  const applyCartAttributesChange = useApplyAttributeChange();
  const cartLines = useCartLines();

  // React state hooks
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch prices for given variant IDs
  const fetchShopPrices = useCallback(async (variantIds: string[]): Promise<Record<string, Price>> => {
    try {
      const result = await query<{ nodes: { id: string, price: Price }[] }>(
        `
        query ($variantIds: [ID!]!) {
          nodes(ids: $variantIds) {
            ... on ProductVariant {
              id
              price {
                amount
                currencyCode
              }
            }
          }
        }`,
        { variables: { variantIds } }
      );

      return result.data.nodes.reduce((prices, node) => {
        prices[node.id] = node.price;
        return prices;
      }, {} as Record<string, Price>);
    } catch (error) {
      console.error("Error fetching shop prices:", error);
      throw error;
    }
  }, [query]);

  // Function to encrypt a given price
  const encryptPrice = useCallback(async (price: Price): Promise<string> => {
    try {
      const response = await fetch('https://cache-money-tyr2xq.tunnel.shopifycloud.tech/encrypt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: price.amount }),
      });

      if (!response.ok) {
        throw new Error('Failed to encrypt price');
      }

      const data: EncryptedPriceResponse = await response.json();
      return data.encryptedData;
    } catch (error) {
      console.error("Error encrypting price:", error);
      throw error;
    }
  }, []);

  // Function to add encrypted total price as a cart attribute
  const addCartTotalPriceAttribute = useCallback(async (encryptedTotalPrice: string) => {
    console.log("Adding cart total price attribute:", encryptedTotalPrice);
    try {
      await applyCartAttributesChange({
        type: "updateAttribute",
        key: "totalPrice",
        value: encryptedTotalPrice,
      });
    } catch (error) {
      console.error("Error applying cart attribute change:", error);
    }
  }, [applyCartAttributesChange]);

  // Effect to process cart lines when component mounts or dependencies change
  useEffect(() => {
    const processCartLines = async () => {
      if (cartLines.length > 0) {
        const variantIds = cartLines.map(line => line.merchandise.id);
        setLoading(true);
        try {
          // Fetch prices for all cart lines
          const prices = await fetchShopPrices(variantIds);

          // Calculate total price
          const totalPrice = cartLines.reduce((total, line) => {
            const price = prices[line.merchandise.id];
            return total + (price ? parseFloat(price.amount) * line.quantity : 0);
          }, 0);

          // Create price object for encryption
          const totalPriceObject: Price = {
            amount: totalPrice.toFixed(2),
            currencyCode: prices[cartLines[0].merchandise.id].currencyCode,
          };

          // Encrypt total price and update cart attribute
          const encryptedTotalPrice = await encryptPrice(totalPriceObject);
          await addCartTotalPriceAttribute(encryptedTotalPrice);
        } catch (error) {
          console.error("Error processing cart lines:", error);
          setError("Failed to process cart lines");
        } finally {
          setLoading(false);
        }
      }
    };

    processCartLines();
  }, [fetchShopPrices, encryptPrice, addCartTotalPriceAttribute]);

  // Check if attribute changes are supported
  if (!instructions.attributes.canUpdateAttributes) {
    return (
      <Banner title="checkout-ui" status="warning">
        {translate("attributeChangesAreNotSupported")}
      </Banner>
    );
  }

  // Render loading banner if data is being fetched
  if (loading) {
    return <Banner title="Loading..." status="info">loading</Banner>;
  }

  // Render error banner if there was an error
  if (error) {
    return <Banner title="Error" status="critical">error</Banner>;
  }

  // Render nothing if everything is fine
  return null;
}
