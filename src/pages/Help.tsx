import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import "./Help.css";

const SUPPORT_EMAIL = "karnarogers9@gmail.com";

export function Help() {
  const mailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("DaDy's.ai support request")}`;

  return (
    <div className="app-main help-page">
      <div className="help-top">
        <div>
          <h1>Contact</h1>
          <p>
            Support for credits, payments, and generations — reach us anytime and we&apos;ll help you
            get unstuck.
          </p>
        </div>
        <a href={mailHref}>
          <Button variant="lime">Email support</Button>
        </a>
      </div>

      <section className="help-card help-card-accent">
        <h2>Get in touch</h2>
        <p>
          For any query, kindly drop a mail to{" "}
          <a className="help-mail" href={mailHref}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="help-note">
          We typically respond to all queries within <strong>24 hours</strong>.
        </p>
      </section>

      <div className="help-grid">
        <article className="help-card">
          <h3>Payments &amp; credits</h3>
          <ul>
            <li>Bought credits but balance not updated?</li>
            <li>UPI / Razorpay charged twice or failed mid-checkout?</li>
            <li>Generation stuck, refunded incorrectly, or credits missing?</li>
          </ul>
          <p>
            Email <a href={mailHref}>{SUPPORT_EMAIL}</a> and{" "}
            <strong>attach a screenshot</strong> of the payment confirmation, bank SMS/UPI receipt,
            or the credits / generation error screen.
          </p>
          <p className="help-note">
            Our team will review and get back to you typically within <strong>24 hours</strong>.
          </p>
        </article>

        <article className="help-card">
          <h3>What to include in your mail</h3>
          <ul>
            <li>Registered email on DaDy&apos;s.ai</li>
            <li>Approximate date &amp; time of the issue</li>
            <li>Order / payment ID if available</li>
            <li>Clear screenshot(s) of the failure or wallet balance</li>
            <li>Short description of what you tried</li>
          </ul>
        </article>

        <article className="help-card">
          <h3>Generations</h3>
          <ul>
            <li>
              <strong>Image / Video Studio</strong> — pick a model, set duration &amp; ratio, then
              Generate.
            </li>
            <li>
              <strong>Projects &amp; Templates</strong> — completed outputs only (failed jobs are
              hidden).
            </li>
            <li>
              <strong>Wishlist</strong> — save images and videos from either studio.
            </li>
            <li>
              Long-running videos may take a few minutes; use <strong>Stop</strong> after 3 minutes
              if needed (unused credits can be refunded).
            </li>
          </ul>
        </article>

        <article className="help-card">
          <h3>Quick links</h3>
          <div className="help-links">
            <Link to="/app/create/image">
              <Button variant="ghost" block>
                Open Image Studio
              </Button>
            </Link>
            <Link to="/app/video">
              <Button variant="ghost" block>
                Open Video Studio
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="ghost" block>
                Buy credits
              </Button>
            </Link>
            <Link to="/app">
              <Button variant="ghost" block>
                Back to Home
              </Button>
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
