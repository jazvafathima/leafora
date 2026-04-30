<form action="/user/verify-otp" method="POST">
  <input type="hidden" name="email" value="<%= email %>">
  <input type="text" name="otp" placeholder="Enter OTP" required>
  <button type="submit">Verify OTP</button>
</form>