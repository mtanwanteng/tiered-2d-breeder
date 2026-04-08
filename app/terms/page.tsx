import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms and Conditions – Bari The Architect",
};

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.backLink}>← back to home</Link>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>Terms and Conditions</h1>
          <p className={styles.date}>Last updated: April 7, 2026</p>
        </div>
        <div className={styles.scrollBody}>
          <p>Please read these terms and conditions carefully before using Our Service.</p>

          <h2>Interpretation and Definitions</h2>
          <h3>Interpretation</h3>
          <p>
            The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.
          </p>

          <h3>Definitions</h3>
          <p>For the purposes of these Terms and Conditions:</p>
          <ul>
            <li><strong>Company</strong> (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to Always Hungry Games, Inc., 1070 Placeholder Way, San Francisco, CA 94158.</li>
            <li><strong>Country</strong> refers to: California, United States</li>
            <li><strong>Service</strong> refers to the Website.</li>
            <li><strong>Website</strong> refers to Bari The Architect.</li>
            <li><strong>You</strong> means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.</li>
          </ul>

          <h2>Acknowledgment</h2>
          <p>
            These are the Terms and Conditions governing the use of this Service and the agreement that operates between You and the Company.
          </p>
          <p>
            By accessing or using the Service You agree to be bound by these Terms and Conditions. If You disagree with any part of these Terms and Conditions then You may not access the Service.
          </p>
          <p>
            You represent that you are over the age of 18. The Company does not permit those under 18 to use the Service.
          </p>

          <h2>User Accounts</h2>
          <p>
            When You create an account with Us, You must provide Us information that is accurate, complete, and current at all times.
          </p>
          <p>
            You are responsible for safeguarding the password that You use to access the Service and for any activities or actions under Your password.
          </p>
          <p>
            You agree not to disclose Your password to any third party. You must notify Us immediately upon becoming aware of any breach of security or unauthorized use of Your account.
          </p>

          <h2>Intellectual Property</h2>
          <p>
            The Service and its original content, features and functionality are and will remain the exclusive property of the Company and its licensors.
          </p>
          <p>
            The Service is protected by copyright, trademark, and other laws of both the Country and foreign countries.
          </p>

          <h2>Termination</h2>
          <p>
            We may terminate or suspend Your Account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms and Conditions.
          </p>
          <p>Upon termination, Your right to use the Service will cease immediately.</p>

          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, in no event shall the Company or its suppliers be liable for any special, incidental, indirect, or consequential damages whatsoever.
          </p>

          <h2>"AS IS" and "AS AVAILABLE" Disclaimer</h2>
          <p>
            The Service is provided to You "AS IS" and "AS AVAILABLE" and with all faults and defects without warranty of any kind.
          </p>

          <h2>Governing Law</h2>
          <p>
            The laws of the Country, excluding its conflicts of law rules, shall govern this Terms and Your use of the Service.
          </p>

          <h2>Changes to These Terms and Conditions</h2>
          <p>
            We reserve the right, at Our sole discretion, to modify or replace these Terms at any time.
          </p>

          <h2>Contact Us</h2>
          <p>If you have any questions about these Terms and Conditions, You can contact us:</p>
          <ul>
            <li>By email: <a href="mailto:placeholder@gmail.com">placeholder@gmail.com</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
