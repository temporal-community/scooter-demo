# Stripe Setup Steps
The following steps must be performed prior to the 
demo. They establish the customer, product, pricing, 
and other aspects of usage-based billing.

[A Stripe developer account](https://dashboard.stripe.com/register)
is required to perform these steps, and since this is a demo, 
all of them take place in Stripe's test environment.


## Creating a Customer in Stripe
The first step is to create a Customer in Stripe, 
which represents the person who will be riding 
(or at least paying charges associated with) the 
scooter. 

1. Go to the [Customers page](https://dashboard.stripe.com/test/customers)
2. Click the white **+ Create** button (near the upper-right corner)
3. In the **First name** field, enter `Maria`
4. In the **Last name** field, enter `Hernandez`
5. In the **Email** field, enter `maria@example.com`
6. Click the purple **Create** button (near the lower-right corner)

Make a note of the customer ID. The Customer I created had an ID
value of `cus_SFmT8nm5VxJNeS`. 


## Creating a Meter for usage-based billing
The next step is to create a Meter, which records usage information
for that customer. 

1. Go to the [Meters page](https://dashboard.stripe.com/test/meters)
2. Click the purple **Create test meter** button (near the upper-right corner)
3. In the **Meter Name** field, enter `Tokens Consumed`
4. Ensure that the **Event Name** field says `tokens_consumed`, 
   and if it does not, change it to have that value.
5. Click the purple **Create meter** button (near the lower-right corner)


## Create a Product

This represents the thing we sell (namely, tokens that correspond to
various ways of incurring fees while using the scooter). 

1. Go to the [Products page](https://dashboard.stripe.com/test/products)
2. Click the purple **Create product** button on the right side of the page
3. In the **Name** field, enter `ACME Scooter Token`
4. Ensure that the **Recurring** button above the **Amount** field is selected
5. Ensure that **Monthly** is selected in the **Billing Period** dropdown
6. Click the **More pricing options** link
7. In the **Choose your pricing model** dropdown, select `Usage-based`
8. Select **Per Unit** from the dropdown just below `Usage-based`
9. In the **Amount** field, enter `25.00`
10. In the **per** field, enter `1000`
11. Under the **Meter** heading, select `Tokens Consumed`
12. Click the purple **Next** button at the bottom of the form
13. Click the purple **Add product** button (at the bottom-right of the page)
14. Click the **ACME Scooter Token** item to see its details.

Note the Product ID. In my case, it was `prod_SFnhGFmm4JQBCM`.

## Create a Subscription

1. Go to the [Subcriptions page](https://dashboard.stripe.com/test/subscriptions)
2. Click the purple **Create test subscription** button
3. Select the customer you created earlier (Maria Hernandez)
4. In the Product field (below the **PRODUCT** heading), 
   select the price of the product you created earlier 
   (that selects the product by association). 
5. Click the purple **Create test subscription** button at
   the bottom of the page. 


## Post-Setup Tasks (Optional)

At this point, setup in Stripe is complete.

During the demo, you may wish to go to the 
[Meters page](https://dashboard.stripe.com/test/meters) 
and select the Meter you set up earlier. You should find
that it shows usage activity generated during the demo.
