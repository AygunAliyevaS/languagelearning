import { Meta } from 'react-router';

export const meta = () => {
  return [
    { title: 'Privacy Policy - Language Learning App' },
    { name: 'description', content: 'Comprehensive privacy policy for our language learning application' },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 prose prose-lg dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
      
      <h2>Introduction</h2>
      <p>
        This Privacy Policy describes how we collect, use, share, and protect your information when you use our language learning application (the "App"). We are committed to protecting your privacy and being transparent about our data practices.
      </p>

      <h2>Information We Collect</h2>
      
      <h3>Personal Information</h3>
      <ul>
        <li><strong>Email Address:</strong> Used for account identification and authentication</li>
        <li><strong>Username:</strong> Display name within the application</li>
        <li><strong>Learning Progress:</strong> XP points, streak data, and CEFR level</li>
        <li><strong>Learning Activity:</strong> Lesson completion, vocabulary review performance, and study patterns</li>
      </ul>

      <h3>Automatically Collected Information</h3>
      <ul>
        <li><strong>Usage Data:</strong> App interactions, feature usage, and time spent in the app</li>
        <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
        <li><strong>Technical Data:</strong> IP address, error logs, and performance metrics</li>
      </ul>

      <h3>Learning Data</h3>
      <ul>
        <li><strong>Vocabulary Progress:</strong> Words learned, review intervals, and performance ratings</li>
        <li><strong>Spaced Repetition Data:</strong> Review schedules, ease factors, and repetition counts</li>
        <li><strong>Lesson Completion:</strong> Progress through language lessons and exercises</li>
      </ul>

      <h2>How We Use Your Information</h2>
      
      <h3>Core Service Functions</h3>
      <ul>
        <li>Provide and maintain the language learning service</li>
        <li>Track your learning progress and personalize your experience</li>
        <li>Implement spaced repetition algorithms for optimal vocabulary retention</li>
        <li>Manage your account and provide customer support</li>
      </ul>

      <h3>Service Improvement</h3>
      <ul>
        <li>Analyze usage patterns to improve app functionality</li>
        <li>Monitor performance and fix technical issues</li>
        <li>Develop new features based on user behavior insights</li>
      </ul>

      <h3>Communication</h3>
      <ul>
        <li>Send important service announcements and updates</li>
        <li>Respond to your inquiries and support requests</li>
        <li>Provide learning progress reports and motivational content</li>
      </ul>

      <h2>Data Sharing and Third Parties</h2>
      
      <h3>Service Providers</h3>
      <p>We share information with the following third-party service providers:</p>
      <ul>
        <li><strong>Neon Database:</strong> Cloud database hosting for user data and learning content</li>
        <li><strong>Authentication Providers:</strong> Secure login services (if enabled)</li>
        <li><strong>Content Delivery Networks:</strong> Fast delivery of app resources</li>
      </ul>

      <h3>No Advertising or Marketing</h3>
      <p>
        We do not sell your personal information to third parties for advertising or marketing purposes. 
        We do not use your data for behavioral advertising or cross-app tracking.
      </p>

      <h3>Legal Requirements</h3>
      <p>
        We may disclose your information if required by law, court order, or to protect our rights, 
        property, or safety, or that of our users or the public.
      </p>

      <h2>Data Security</h2>
      
      <h3>Security Measures</h3>
      <ul>
        <li>Encryption of data in transit using HTTPS/TLS</li>
        <li>Secure database storage with access controls</li>
        <li>Regular security audits and vulnerability assessments</li>
        <li>Employee access restrictions and training</li>
      </ul>

      <h3>Data Retention</h3>
      <p>
        We retain your information only as long as necessary to provide our services and comply 
        with legal obligations. Learning progress data is retained indefinitely to maintain your 
        educational continuity, but you may request deletion at any time.
      </p>

      <h2>Your Rights and Choices</h2>
      
      <h3>Access and Correction</h3>
      <ul>
        <li>View and update your profile information through the app settings</li>
        <li>Request a copy of your data by contacting our support team</li>
        <li>Correct inaccurate information in your account</li>
      </ul>

      <h3>Data Deletion</h3>
      <ul>
        <li>Delete your account and all associated data through the app</li>
        <li>Request data deletion by contacting our support team</li>
        <li>Understand that deletion will remove all learning progress</li>
      </ul>

      <h3>Data Portability</h3>
      <ul>
        <li>Export your learning progress and data in a readable format</li>
        <li>Transfer your data to other services where technically feasible</li>
      </ul>

      <h3>Opt-Out Choices</h3>
      <ul>
        <li>Disable certain data collection through app settings</li>
        <li>Opt out of communications while maintaining core service access</li>
        <li>Control cookie and tracking preferences in your browser</li>
      </ul>

      <h2>Children's Privacy</h2>
      <p>
        Our service is not directed to children under 13 (or applicable age in your jurisdiction). 
        We do not knowingly collect personal information from children. If we become aware of 
        collecting information from a child, we will delete it promptly.
      </p>

      <h2>International Data Transfers</h2>
      <p>
        Your information may be processed and stored in servers located outside your country. 
        We ensure appropriate safeguards are in place for international data transfers in 
        accordance with applicable data protection laws.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of significant 
        changes by posting the new policy in the app and updating the "Last Updated" date. 
        Continued use of the service after changes constitutes acceptance of the updated policy.
      </p>

      <h2>Contact Information</h2>
      <p>
        If you have questions about this Privacy Policy or want to exercise your rights, 
        please contact us at:
      </p>
      <ul>
        <li><strong>Email:</strong> privacy@languagelearning.app</li>
        <li><strong>Support:</strong> support@languagelearning.app</li>
      </ul>

      <h2>App Store Privacy Disclosure</h2>
      <p>
        In compliance with App Store requirements, we disclose the following:
      </p>
      <ul>
        <li><strong>Data Collection:</strong> Email, learning progress, usage analytics</li>
        <li><strong>Data Usage:</strong> Service provision, personalization, performance optimization</li>
        <li><strong>Data Sharing:</strong> Only with essential service providers, not for advertising</li>
        <li><strong>User Control:</strong> Account deletion, data export, privacy settings</li>
      </ul>

      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Summary of Key Points</h3>
        <ul className="text-sm space-y-1">
          <li>• We collect only necessary information for language learning</li>
          <li>• Your data is never sold to advertisers</li>
          <li>• We use industry-standard security measures</li>
          <li>• You have full control over your data</li>
          <li>• We are transparent about all data practices</li>
        </ul>
      </div>
    </div>
  );
}
