import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy – Bari The Architect",
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.backLink}>← back to home</Link>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.date}>Last updated: May 08, 2024</p>
        </div>
        <div className={styles.scrollBody}>
          <p>
            This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.
          </p>
          <p>
            We use Your Personal data to provide and improve the Service. By using the Service, You agree to the collection and use of information in accordance with this Privacy Policy.
          </p>

          <h2>Interpretation and Definitions</h2>
          <h3>Interpretation</h3>
          <p>
            The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.
          </p>

          <h3>Definitions</h3>
          <p>For the purposes of this Privacy Policy:</p>
          <ul>
            <li><strong>Account</strong> means a unique account created for You to access our Service or parts of our Service.</li>
            <li><strong>Company</strong> (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to Always Hungry Games, Inc., 1070 Placeholder Way, San Francisco, CA 94158.</li>
            <li><strong>Cookies</strong> are small files that are placed on Your computer, mobile device or any other device by a website, containing the details of Your browsing history on that website among its many uses.</li>
            <li><strong>Country</strong> refers to: California, United States</li>
            <li><strong>Device</strong> means any device that can access the Service such as a computer, a cellphone or a digital tablet.</li>
            <li><strong>Personal Data</strong> is any information that relates to an identified or identifiable individual.</li>
            <li><strong>Service</strong> refers to the Website.</li>
            <li><strong>Website</strong> refers to Bari The Architect.</li>
            <li><strong>You</strong> means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.</li>
          </ul>

          <h2>Collecting and Using Your Personal Data</h2>
          <h3>Types of Data Collected</h3>
          <h4>Personal Data</h4>
          <p>
            While using Our Service, We may ask You to provide Us with certain personally identifiable information that can be used to contact or identify You. Personally identifiable information may include, but is not limited to:
          </p>
          <ul>
            <li>Email address</li>
            <li>First name and last name</li>
            <li>Usage Data</li>
          </ul>

          <h4>Usage Data</h4>
          <p>Usage Data is collected automatically when using the Service.</p>
          <p>
            Usage Data may include information such as Your Device's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that You visit, the time and date of Your visit, the time spent on those pages, unique device identifiers and other diagnostic data.
          </p>

          <h3>Use of Your Personal Data</h3>
          <p>The Company may use Personal Data for the following purposes:</p>
          <ul>
            <li><strong>To provide and maintain our Service</strong>, including to monitor the usage of our Service.</li>
            <li><strong>To manage Your Account:</strong> to manage Your registration as a user of the Service.</li>
            <li><strong>To contact You:</strong> To contact You by email, telephone calls, SMS, or other equivalent forms of electronic communication.</li>
            <li><strong>To manage Your requests:</strong> To attend and manage Your requests to Us.</li>
          </ul>

          <h3>Retention of Your Personal Data</h3>
          <p>
            The Company will retain Your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy.
          </p>

          <h3>Transfer of Your Personal Data</h3>
          <p>
            Your information, including Personal Data, is processed at the Company's operating offices and in any other places where the parties involved in the processing are located.
          </p>

          <h3>Delete Your Personal Data</h3>
          <p>
            You have the right to delete or request that We assist in deleting the Personal Data that We have collected about You.
          </p>

          <h3>Security of Your Personal Data</h3>
          <p>
            The security of Your Personal Data is important to Us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure.
          </p>

          <h2>Children's Privacy</h2>
          <p>
            Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from anyone under the age of 13.
          </p>

          <h2>Links to Other Websites</h2>
          <p>
            Our Service may contain links to other websites that are not operated by Us. If You click on a third party link, You will be directed to that third party's site. We strongly advise You to review the Privacy Policy of every site You visit.
          </p>

          <h2>Changes to this Privacy Policy</h2>
          <p>
            We may update Our Privacy Policy from time to time. We will notify You of any changes by posting the new Privacy Policy on this page.
          </p>

          <h2>Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, You can contact us:</p>
          <ul>
            <li>By email: <a href="mailto:placeholder@gmail.com">placeholder@gmail.com</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
