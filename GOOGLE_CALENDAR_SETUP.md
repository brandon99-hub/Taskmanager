# 🔗 Google Calendar Integration Setup Guide

## 📋 **Complete Step-by-Step Instructions**

### **Step 1: Google Cloud Console Project Setup**

#### **1.1 Create New Project**
1. **Open** [Google Cloud Console](https://console.cloud.google.com/)
2. **Click** the project dropdown at the top of the page
3. **Click** "New Project" 
4. **Fill in project details:**
   ```
   Project Name: TaskFlow Calendar Integration
   Organization: [Your Organization] (optional)
   Location: [Your Organization] (optional)
   ```
5. **Click** "Create"
6. **Wait** for project creation (30-60 seconds)
7. **Select** your new project from the dropdown

#### **1.2 Enable Required APIs**
1. **Navigate** to "APIs & Services" → "Library" (left sidebar)
2. **Search** for "Google Calendar API"
3. **Click** on "Google Calendar API" result
4. **Click** "Enable" button
5. **Wait** for API to be enabled (10-20 seconds)

---

### **Step 2: OAuth Consent Screen Configuration**

#### **2.1 Configure Consent Screen**
1. **Navigate** to "APIs & Services" → "OAuth consent screen"
2. **Select** User Type:
   - **Internal**: If this is for your organization only (Google Workspace users)
   - **External**: If external users will connect their calendars
3. **Click** "Create"

#### **2.2 App Information**
Fill in the required information:
```
App name: TaskFlow Calendar Integration
User support email: your-email@company.com
App logo: [Optional - upload TaskFlow logo]
Developer contact information: your-email@company.com
```

#### **2.3 Scopes Configuration**
1. **Click** "Add or Remove Scopes"
2. **Search** and select:
   ```
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/userinfo.email
   ```
3. **Click** "Update"
4. **Click** "Save and Continue"

#### **2.4 Test Users (if External)**
If you selected "External" user type:
1. **Click** "Add Users"
2. **Add** test user email addresses:
   ```
   your-email@company.com
   project-manager@company.com
   ```
3. **Click** "Save and Continue"

---

### **Step 3: Create OAuth 2.0 Credentials**

#### **3.1 Create Credentials**
1. **Navigate** to "APIs & Services" → "Credentials"
2. **Click** "Create Credentials" → "OAuth client ID"
3. **Select** Application type: "Web application"

#### **3.2 Configure Web Application**
```
Name: TaskFlow Calendar Integration

Authorized JavaScript origins:
- http://localhost:5000 (for development)
- https://your-domain.com (for production)

Authorized redirect URIs:
- http://localhost:5000/api/auth/google/callback
- https://your-domain.com/api/auth/google/callback
```

#### **3.3 Download Credentials**
1. **Click** "Create"
2. **Copy** the Client ID and Client Secret (save them securely!)
3. **Click** "Download JSON" for backup
4. **Click** "OK"

---

### **Step 4: Extract Required Information**

From your credentials, you'll need these values:

#### **4.1 Client Credentials**
```json
{
  "client_id": "123456789-abcdefghijklmnop.apps.googleusercontent.com",
  "client_secret": "GOCSPX-your_client_secret_here_32_characters",
  "redirect_uris": ["http://localhost:5000/api/auth/google/callback"]
}
```

#### **4.2 Environment Variables**
Add these to your `.env` file:
```env
# Google Calendar Integration
GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your_client_secret_here_32_characters"
GOOGLE_REDIRECT_URI="http://localhost:5000/api/auth/google/callback"

# Production redirect URI (update for production)
# GOOGLE_REDIRECT_URI="https://your-domain.com/api/auth/google/callback"
```

---

### **Step 5: Email Configuration Setup**

#### **5.1 Gmail Configuration (Recommended)**
If using Gmail for email notifications:

1. **Enable 2-Step Verification:**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable "2-Step Verification"

2. **Generate App Password:**
   - Go to "App passwords" section
   - Select app: "Mail"
   - Select device: "Other (Custom name)"
   - Enter: "TaskFlow Email Service"
   - **Copy** the 16-character password

3. **Add to .env file:**
```env
# Email Configuration (Gmail)
EMAIL_PROVIDER="gmail"
GMAIL_USER="your-taskflow-email@gmail.com"
GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"  # 16-character app password
EMAIL_FROM="TaskFlow <noreply@yourdomain.com>"
```

#### **5.2 SMTP Configuration (Alternative)**
If using another email provider:
```env
# Email Configuration (SMTP)
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_USER="your-smtp-username"
SMTP_PASS="your-smtp-password"
EMAIL_FROM="TaskFlow <noreply@yourdomain.com>"
```

---

### **Step 6: Testing Your Setup**

#### **6.1 Test Calendar Connection**
1. **Start** your TaskFlow development server:
   ```bash
   npm run dev
   ```

2. **Navigate** to the profile page
3. **Try** connecting Google Calendar
4. **Check** console logs for any errors

#### **6.2 Test Email Sending**
1. **Assign** a task to a user
2. **Check** that the email notification is sent
3. **Verify** email formatting and content

#### **6.3 Verify Environment Variables**
Create a test script to verify your setup:
```javascript
// test-setup.js
console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('Google Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('Gmail User:', process.env.GMAIL_USER ? '✅ Set' : '❌ Missing');
console.log('Gmail Password:', process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ Missing');
```

---

### **Step 7: Production Deployment**

#### **7.1 Update OAuth Credentials**
1. **Go back** to Google Cloud Console → Credentials
2. **Edit** your OAuth client ID
3. **Add production URLs:**
   ```
   Authorized JavaScript origins:
   - https://your-production-domain.com
   
   Authorized redirect URIs:
   - https://your-production-domain.com/api/auth/google/callback
   ```

#### **7.2 Update Environment Variables**
```env
# Production Environment Variables
NODE_ENV="production"
FRONTEND_URL="https://your-production-domain.com"
GOOGLE_REDIRECT_URI="https://your-production-domain.com/api/auth/google/callback"

# Keep all other Google and email settings the same
```

#### **7.3 SSL Certificate**
Ensure your production domain has a valid SSL certificate (required for OAuth).

---

### **Step 8: Security Best Practices**

#### **8.1 Credential Security**
- ✅ **Never** commit `.env` files to version control
- ✅ **Use** environment variables for all secrets
- ✅ **Rotate** OAuth credentials annually
- ✅ **Monitor** API usage in Google Cloud Console

#### **8.2 User Privacy**
- ✅ **Clearly explain** what calendar access is used for
- ✅ **Provide** easy disconnection options
- ✅ **Respect** user preferences for notifications
- ✅ **Only sync** task-related events

#### **8.3 Error Handling**
- ✅ **Handle** token expiration gracefully
- ✅ **Provide** clear error messages to users
- ✅ **Log** errors for debugging (without exposing tokens)
- ✅ **Implement** retry logic for failed API calls

---

### **Step 9: Troubleshooting Common Issues**

#### **9.1 "Error 400: redirect_uri_mismatch"**
**Solution:** 
- Double-check redirect URIs in Google Cloud Console
- Ensure exact match including protocol (http/https)
- Clear browser cache and try again

#### **9.2 "Error 403: access_denied"**
**Solution:**
- Check OAuth consent screen configuration
- Ensure user is added to test users (if external app)
- Verify scopes are correctly configured

#### **9.3 "Error 401: invalid_grant"**
**Solution:**
- Refresh token may have expired
- Re-authenticate the user
- Check system clock synchronization

#### **9.4 Email Not Sending**
**Solution:**
- Verify Gmail app password is correct
- Check SMTP settings if using custom provider
- Ensure EMAIL_FROM domain is authorized
- Check spam/junk folders

---

### **Step 10: Monitoring & Maintenance**

#### **10.1 Monitor API Usage**
- **Check** Google Cloud Console → APIs & Services → Dashboard
- **Set up** quota alerts if needed
- **Monitor** for unusual usage patterns

#### **10.2 Regular Maintenance**
- **Review** error logs monthly
- **Update** dependencies regularly
- **Test** email deliverability quarterly
- **Rotate** credentials annually

---

## 🎯 **Quick Setup Checklist**

### **Essential Steps:**
- [ ] Create Google Cloud Project
- [ ] Enable Calendar API
- [ ] Configure OAuth consent screen
- [ ] Create OAuth 2.0 credentials
- [ ] Set up email authentication (Gmail app password)
- [ ] Add environment variables to `.env`
- [ ] Test calendar connection
- [ ] Test email notifications
- [ ] Update production URLs when deploying

### **Environment Variables Checklist:**
```env
# Required for Google Calendar
✅ GOOGLE_CLIENT_ID
✅ GOOGLE_CLIENT_SECRET  
✅ GOOGLE_REDIRECT_URI

# Required for Email
✅ EMAIL_PROVIDER
✅ GMAIL_USER (or SMTP settings)
✅ GMAIL_APP_PASSWORD (or SMTP credentials)
✅ EMAIL_FROM

# Application Settings
✅ FRONTEND_URL
✅ NODE_ENV
```

---

## 📞 **Need Help?**

If you encounter issues during setup:

1. **Check** the console logs for specific error messages
2. **Verify** all environment variables are set correctly
3. **Test** each component separately (OAuth, then email)
4. **Review** Google Cloud Console audit logs
5. **Ensure** your domain has proper SSL certificates

**Remember:** The initial setup takes 15-30 minutes, but once configured, the integration works seamlessly!

---

## ✅ **Setup Complete!**

Once you've completed these steps, your TaskFlow application will have:
- 🔗 **Google Calendar integration** for task deadline syncing
- 📧 **Beautiful email notifications** for task assignments and reminders
- ⚙️ **User-configurable preferences** for notification settings
- 🔒 **Enterprise-grade security** with encrypted token storage

Your users can now:
- Connect their Google Calendar to sync task deadlines
- Receive professional email notifications
- Customize their notification preferences
- Get automatic reminders before tasks become overdue
