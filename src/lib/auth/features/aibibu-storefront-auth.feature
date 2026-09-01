Feature: Aibibu customer identity in the Saleor storefront
  As an Aibibu customer
  I want to use my existing Aibibu identity in the storefront
  So that I do not need a separate Saleor password

  Scenario: OAuth credentials stay on the server
    Given Supabase redirects the embedded flow with a PKCE-bound authorization code
    When Storefront completes the code exchange through Aibibu Server
    Then the browser receives no Supabase access token or refresh token
    And Storefront stores the resulting session in secure HttpOnly cookies

  Scenario: Existing Aibibu user signs in
    Given I have a valid verified Aibibu Supabase session
    When I complete Storefront sign-in
    Then Storefront stores the session in secure HttpOnly cookies
    And my account resolves through Aibibu Server

  Scenario: Invalid or expired session is rejected
    Given my Supabase session is invalid or expired
    When Storefront resolves my account
    Then I am treated as signed out
    And no Saleor customer data is returned

  Scenario: First Storefront access provisions a Saleor Customer
    Given no Saleor Customer maps to my verified Supabase subject
    When I open my Storefront account
    Then Aibibu provisions one Customer using my verified subject

  Scenario: Repeated Storefront access reuses the Saleor Customer
    Given a Saleor Customer already maps to my verified Supabase subject
    When I open my Storefront account again
    Then Aibibu reuses the existing Customer

  Scenario: Browser identity fields are ignored
    Given I am signed in as customer A
    When a browser request includes customer B identity fields
    Then Aibibu uses customer A verified Supabase subject

  Scenario: Orders are isolated by verified identity
    Given customers A and B each have orders
    When customer A opens order history
    Then only customer A orders are returned

  Scenario: Authenticated checkout is attached to the verified customer
    Given I have a valid verified Aibibu Supabase session
    When I create or attach a Storefront checkout
    Then Aibibu derives checkout ownership from my verified subject
    And the browser cannot choose a Saleor Customer

  Scenario: Customer logs out
    Given I have an active Storefront session
    When I log out
    Then Storefront clears all customer session cookies

  Scenario: Saleor native customer auth is unavailable
    When I visit Storefront signup or password reset
    Then I am directed to the Aibibu identity flow
    And no Saleor customer credential is created

  Scenario: Saleor staff login is unchanged
    Given I am a Saleor staff user
    When I sign in to Saleor Dashboard
    Then the existing Saleor staff authentication flow is used
