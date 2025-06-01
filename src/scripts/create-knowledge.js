import { MongoClient, ObjectId } from "mongodb";

// Replace with your actual MongoDB URI and User ID
const uri = "mongodb+srv://otabek:7ltxFDiBcrFNjtrw@cluster0.poqkapp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "test";
const collectionName = "knowledgebases";
const dummyAuthorId = new ObjectId("683367fd7c92abd42355c379"); // Replace with a valid User ID

// Define articles with detailed Markdown content
const articles = [
    {
        title: "How to Fix a Slow Computer",
        content: `
# How to Fix a Slow Computer

A slow computer can hinder productivity. This guide provides steps to diagnose and improve performance on Windows and Mac systems.

## Common Causes
- **Low RAM**: Insufficient memory for multitasking.
- **Full Storage**: Less than 15% free space slows operations.
- **Background Apps**: Unnecessary programs consuming resources.
- **Malware**: Viruses impacting performance.

## Solutions
### 1. Free Up Storage
- **Windows**: Use Disk Cleanup to remove temporary files.
- **Mac**: Go to "About This Mac" > "Storage" > "Manage" to optimize space.

### 2. Disable Startup Programs
- **Windows**: Open Task Manager (Ctrl+Shift+Esc) > Startup tab > Disable unnecessary apps.
- **Mac**: System Preferences > Users & Groups > Login Items > Remove apps.

### 3. Scan for Malware
- Use antivirus software like Windows Defender or Malwarebytes.
- Schedule regular scans to prevent infections.

### 4. Upgrade Hardware
- Add more RAM if usage exceeds 80%.
- Consider switching to an SSD for faster performance.

## Prevention Tips
- Keep software updated.
- Avoid installing unnecessary programs.
- Restart your computer weekly.

## Conclusion
Regular maintenance and these steps can significantly improve your computer's speed. For persistent issues, contact a technician.
    `,
        category: "technical",
        tags: ["performance", "windows", "mac", "optimization"],
        difficulty: "Beginner",
        readTime: 5,
        featuredImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800",
    },
    {
        title: "Troubleshooting Network Connectivity Issues",
        content: `
# Troubleshooting Network Connectivity Issues

Network problems can disrupt work and communication. This guide covers solutions for Wi-Fi and Ethernet issues.

## Common Issues
- **No Connection**: Device can't connect to the network.
- **Slow Speeds**: Poor performance despite connection.
- **Intermittent Drops**: Connection cuts in and out.

## Steps to Resolve
### 1. Check Hardware
- Ensure router and modem are powered on.
- Inspect Ethernet cables for damage.

### 2. Restart Equipment
- Power cycle your modem and router.
- Wait 30 seconds before reconnecting.

### 3. Update Drivers
- **Windows**: Device Manager > Network Adapters > Update Driver.
- **Mac**: Ensure macOS is up to date via System Preferences.

### 4. Check Settings
- Verify Wi-Fi password and network settings.
- Forget and reconnect to the network if needed.

## Advanced Troubleshooting
- Change DNS settings to Google DNS (8.8.8.8).
- Contact your ISP if issues persist.

## Conclusion
Most network issues can be resolved with these steps. For complex problems, consult a network technician.
    `,
        category: "technical",
        tags: ["wifi", "ethernet", "router", "connectivity"],
        difficulty: "Intermediate",
        readTime: 8,
        featuredImage: "https://images.unsplash.com/photo-1558089687-f282ffcbc126?auto=format&fit=crop&w=800",
    },
    {
        title: "Understanding Your Billing Statements",
        content: `
# Understanding Your Billing Statements

Billing statements can be confusing. This guide explains how to read and manage your statements effectively.

## Key Components
- **Account Summary**: Total balance and due date.
- **Charges**: Breakdown of services and fees.
- **Payment History**: Recent payments and credits.
- **Disputes**: Notes on any contested charges.

## How to Read Your Statement
1. Check the due date to avoid late fees.
2. Review charges for accuracy.
3. Note any pending payments or credits.

## Resolving Disputes
- Contact support within 30 days of the statement date.
- Provide details like invoice number and disputed amount.
- Keep records of all communications.

## Tips
- Set up auto-pay to avoid missed payments.
- Download statements for your records.
- Monitor for unauthorized charges.

## Conclusion
Understanding your billing statement helps you manage payments and avoid issues. Contact our billing team for assistance.
    `,
        category: "billing",
        tags: ["invoice", "payment", "disputes", "billing"],
        difficulty: "Beginner",
        readTime: 6,
        featuredImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800",
    },
    {
        title: "Resetting Your Account Password",
        content: `
# Resetting Your Account Password

Forgot your password or need to update it? Follow these secure steps to reset your account password.

## Steps to Reset
1. Go to the login page and click "Forgot Password."
2. Enter your registered email address.
3. Check your inbox for a reset link (check spam if not found).
4. Click the link and enter a new password.
5. Confirm the new password and save.

## Password Requirements
- Minimum 8 characters.
- Include uppercase, lowercase, numbers, and special characters.
- Avoid reusing old passwords.

## Security Tips
- Use a unique password for each account.
- Enable two-factor authentication (2FA) if available.
- Never share your password with anyone.

## Common Issues
- **No Email Received**: Verify the email address or contact support.
- **Link Expired**: Request a new reset link.
- **Account Locked**: Contact support after multiple failed attempts.

## Conclusion
Resetting your password is simple and secure. For issues, reach out to our support team.
    `,
        category: "account",
        tags: ["password", "account", "security", "reset"],
        difficulty: "Beginner",
        readTime: 4,
        featuredImage: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=800",
    },
    {
        title: "Our Legal Policies Explained",
        content: `
# Our Legal Policies Explained

Understand our terms of service, privacy policies, and your rights as a user with this guide.

## Key Policies
- **Terms of Service**: Rules for using our platform.
- **Privacy Policy**: How we collect, use, and protect your data.
- **Cookie Policy**: Use of cookies for analytics and functionality.
- **User Rights**: Your rights to access, modify, or delete data.

## Terms of Service Highlights
- You must be 18 or older to use our services.
- Prohibited activities include hacking or spamming.
- We may terminate accounts for violations.

## Privacy Policy Summary
- We collect data like email and usage patterns.
- Data is used to improve services and provide support.
- We do not sell personal data to third parties.

## Your Rights
- Request a copy of your data.
- Opt out of marketing emails.
- Delete your account (subject to legal retention periods).

## How to Contact Us
- Email: legal@company.com
- Response time: Within 7 business days.

## Conclusion
Our policies ensure a safe and transparent experience. Review them fully on our website or contact our legal team for clarification.
    `,
        category: "legal",
        tags: ["terms", "privacy", "legal", "policy"],
        difficulty: "Intermediate",
        readTime: 6,
        featuredImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800",
    },
    {
        title: "Getting the Most From Our Business Services",
        content: `
# Getting the Most From Our Business Services

Learn how our services can help your business grow and streamline operations.

## Our Services
- **Cloud Solutions**: Scalable storage and computing.
- **Support Plans**: 24/7 technical assistance.
- **Analytics Tools**: Insights for better decision-making.
- **Integration Services**: Connect with existing systems.

## Benefits
- **Efficiency**: Automate routine tasks.
- **Scalability**: Grow without infrastructure limits.
- **Cost Savings**: Pay only for what you use.
- **Reliability**: 99.9% uptime guarantee.

## Getting Started
1. Sign up for a business account.
2. Choose a service plan that fits your needs.
3. Schedule a consultation with our team.
4. Integrate services with your workflow.

## Success Stories
- **Company A**: Reduced costs by 30% with cloud storage.
- **Company B**: Improved response times with analytics.

## Tips for Success
- Train your team on new tools.
- Monitor usage to optimize costs.
- Contact support for custom solutions.

## Conclusion
Our business services empower growth and efficiency. Contact our sales team to learn more or start a trial.
    `,
        category: "business",
        tags: ["growth", "services", "strategy", "optimization"],
        difficulty: "Advanced",
        readTime: 7,
        featuredImage: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=800",
    },
];

// Map articles and assign relatedArticles after all IDs are generated
async function seed() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Clear existing data (optional, remove to append)
        await collection.deleteMany({});

        // Prepare articles with common fields
        const preparedArticles = articles.map((a) => ({
            ...a,
            excerpt: a.content
                .replace(/[#*>\-`]/g, "") // Remove Markdown symbols
                .trim()
                .split("\n")
                .slice(0, 4) // Take first 4 lines
                .join(" ")
                .substring(0, 500) + "...", // Truncate to 500 characters
            author: dummyAuthorId,
            isPublished: true,
            views: Math.floor(Math.random() * 500),
            lastUpdated: new Date(),
            featuredImage: a.featuredImage || null,
            relatedArticles: [], // Will be updated later
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

        // Insert articles
        const result = await collection.insertMany(preparedArticles);
        console.log(`✅ Inserted ${result.insertedCount} knowledge base articles.`);

        // Assign related articles based on category and tags
        const insertedArticles = await collection.find({}).toArray();
        for (const article of insertedArticles) {
            const related = insertedArticles
                .filter(
                    (a) =>
                        a._id.toString() !== article._id.toString() &&
                        (a.category === article.category ||
                            a.tags.some((tag) => article.tags.includes(tag)))
                )
                .slice(0, 2) // Limit to 2 related articles
                .map((a) => a._id);

            await collection.updateOne(
                { _id: article._id },
                { $set: { relatedArticles: related } }
            );
        }

        console.log(`✅ Updated related articles for all documents.`);
    } catch (err) {
        console.error("❌ Error seeding data:", err);
    } finally {
        await client.close();
    }
}

seed();