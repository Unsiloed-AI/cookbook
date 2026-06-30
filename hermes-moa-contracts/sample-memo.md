CONTRACT RISK MEMO
EdgeMode Inc Master Services Agreement (v. 27 Dec 2024) + Colocation Service Schedule

PARTIES (from the Particulars)
- Customer: CUDO Ventures LTD (UK reg. 11065412, 128 City Road, London EC1V 2NX). finance@cudoventures.com
- Service Provider: EdgeMode Inc (Nevada, tax ID 47-4046237, 110 East Broward Blvd, Fort Lauderdale, FL 33301). simon@edgemode.io
- Governing law / jurisdiction: Florida, U.S. (Cl. 17 / Particulars). Note the oddity that price indexation references UK CPI (Cl. 1.1 CPI / Cl. 5.5).
- Both signed 21 Jan 2025. Reviewed below from the Customer's seat.

A drafting note worth flagging up front: this is EdgeMode's own paper. Nearly every discretionary power runs one way. I walk it clause by clause.

==================================================
CLAUSE-BY-CLAUSE FLAGS
==================================================

1) Rules & Regulations — unilateral change (Cl. 1.1 definition)
Quote: "...or any revision of them made by the Service Provider and notified to the Customer from time to time (via email, the customer portal or displayed within the Data Centre)... Any revision of the Rules & Regulations shall not reduce the performance of the Services or result in an increase to the Fees (but may result in an increase to the charges for Ancillary Services) unless agreed in writing between the parties."
Favours: Service Provider. Severity: Medium-High.
EdgeMode can rewrite operational rules unilaterally and can raise Ancillary Service charges without consent. There is a guardrail (no Fee increase / no Service degradation), but Ancillary charges and new obligations are open.
Redline: Require 30 days' prior written notice; no change that increases Customer cost, creates a material new obligation, or affects security/access without Customer's written agreement.

2) Order-of-precedence (Cl. 1.7)
Quote: "...the Order but only then to the extent it is expressly stated to vary the Master Services Agreement; then the terms and conditions set out in the Master Services Agreement... then the Service Schedules... then the Rules & Regulations, lastly any documents incorporated by reference or appended to an Order..."
Favours: Service Provider. Severity: Medium.
A negotiated Order only overrides the MSA "to the extent it is expressly stated to vary" it — easy to lose a hard-won Order concession because the magic words are missing. The MSA boilerplate therefore beats your commercial deal by default.
Redline: Make the Order rank first generally (your negotiated terms should win), and confirm the Colocation Special Terms (the 3%-waiver / capped CPI) expressly vary Cl. 5.5.

3) Financial-covenant gate on Orders (Cl. 2.2)
Quote: "...entering into an Order by the Service Provider... shall be subject to the Service Provider being reasonably satisfied that the financial covenant strength of the Customer is sufficient..."
Favours: Service Provider. Severity: Low-Medium.
Subjective gate on whether you can even place Orders.
Redline: Objective credit criteria + a fixed decision window with written reasons if declined.

4) Equipment title + acceleration of One-Off Charge on termination (Cl. 3.4)
Quote: "In the event that the relevant Order is terminated or expires prior to the payment of the last instalment of the One-Off Charge, Customer shall immediately pay to Service Provider an amount equivalent to the balance of then unpaid instalments..."
Favours: Service Provider. Severity: High.
Full remaining balance accelerates regardless of cause — including where YOU terminate for EdgeMode's breach or repeated outages. No present-value discount, no fault carve-out.
Redline: Acceleration only on Customer termination for convenience (discounted to present value); no further equipment payment where Customer terminates for SP's uncured material breach or under Annex 2 cl. 6.

5) Customer indemnity — broad and one-directional (Cl. 4.3)
Quote: "The Customer shall keep indemnified, hold harmless and defend the Service Provider in respect of any damage, loss or expense (including legal fees) resulting from: (i) any damage to the Data Centre; (ii) any damage to the fiber; (iii) any damage to the Telehouse; (iv) [third-party] claim... caused by the acts or omissions of the Customer...; or (v)... claim brought against the Service Provider by another user... as a direct result of the Customer drawing power in excess of its Total Contracted Power..."
Favours: Service Provider. Severity: High.
Limbs (i)-(iii) (damage to the DC / fiber / Telehouse) are NOT tied to Customer fault — only limb (iv) carries an "acts or omissions" qualifier. As drafted you could indemnify EdgeMode for facility damage you did not cause. There is no reciprocal SP indemnity to the Customer anywhere (the "indemnity" in Cl. 6 is a mutual tort-law allocation only — see #6).
Redline: Add "to the extent caused by the negligence or breach of the Customer" to limbs (i)-(iii); make the indemnity subject to Cl. 8 cap; add a mirror SP indemnity for IP infringement and for damage caused by EdgeMode.

6) "Indemnity" clause is really a bare tort allocation (Cl. 6.1)
Quote: "(i) Service Provider shall be liable for property damage and bodily injury suffered by Customer in accordance with applicable tort law. (ii) Customer shall be liable for property damage and bodily injury suffered by Service Provider in accordance with applicable tort law. (iii) each party shall be liable for loss or damage suffered by a third party in accordance with applicable tort law."
Favours: Neutral on its face, but note severity Medium.
This only restates tort law and is limited to property damage / bodily injury. There is NO Customer-side indemnity for IP infringement, data loss, or confidentiality breach by EdgeMode. A normal customer protection (SP IP-infringement indemnity) is ABSENT — flagging as requested.
Redline: Add SP indemnity for third-party IP claims arising from the Services.

7) Insurance asymmetry (Cl. 7)
Quote: "...maintain general and products liability insurance providing coverage for third party property damage and bodily injury with a limit of €5,000,000... per occurrence..." plus 7.1.2 "not do anything which would or might... cause any premium for its insurance to be increased" and 7.1.3 pay increased premiums "within 14 days of demand."
Favours: Service Provider. Severity: Medium.
Customer carries €5m cover and underwrites EdgeMode's premium increases on demand; no reciprocal insurance obligation on EdgeMode is stated.
Redline: Require SP to carry equivalent cover; remove the open-ended premium-reimbursement obligation or cap it.

8) Liability cap structure — the €50,000 super-cap (Cl. 8.3-8.5)
Quote (8.3): "...total liability... in any period of 12 months shall not exceed 125% of the Fees payable by the Customer during such period..." (8.5): "...the total liability of each party to the other under this Master Services Agreement shall not exceed €50,000... For the purpose of this Condition 8.5 only, reference to Master Services Agreement does not include any Orders, Service Schedules and Annexes."
Favours: Service Provider (cap is mutual but you are the one with real exposure). Severity: High.
8.5 caps residual MSA-level claims (e.g. confidentiality, the bribery reps, general breach) at €50,000 — derisory when your signing payment alone is ~$303,548.72. The 125%-of-Fees cap is acceptable in shape but excludes Electricity Fees (8.3), which on a colo deal can be the largest line. Note also Cl. 8.6 contains a "reasonableness" acknowledgement that helps EdgeMode defend the cap.
Redline: Raise 8.5 to at least 12 months' total Fees; do not exclude Electricity Fees from the recoverable base; delete the 8.6 acknowledgement or make it mutual.

9) Mutual consequential-loss exclusion (Cl. 8.2)
Quote: "Neither party shall be liable... for: loss of contracts; loss of reputation and/or goodwill;... loss of profit, revenue,... loss of anticipated savings... loss of business;... loss of or damage or destruction of Data; or indirect, consequential or special loss..."
Favours: Service Provider effectively. Severity: High (note "loss... of Data" carve-out).
The exclusion is mutual, but "loss or damage or destruction of Data" sits inside the excluded list. For a data-centre customer that is exactly the harm you fear, and it is excluded as a direct head of loss.
Redline: Carve Data loss out of the exclusion (or make EdgeMode liable for data loss caused by its breach up to the cap).

10) Fee increases / indexation (Cl. 5.5-5.6 vs Special Terms)
Quote (5.5): "...may increase Fees on the Indexation Date each year by three per cent (3%) or (if higher) the percentage increase in the UK CPI..." (5.6): "...may increase Fees at any time to include any reasonable charges, levies or taxes introduced by the government..."
Special Terms (Colo): "The annual minimum fee increase of 3% is waived for the first 3 years... The annual CPI increase will be capped at 2% for the first 3 years... and capped at 5% for the final 2 years."
Favours: Service Provider. Severity: Medium-High.
The Special Terms only protect a 5-year window. On any Extended Term / renewal the MSA default snaps back: greater of 3% floor or uncapped UK CPI. Cl. 5.6 adds open-ended "reasonable" tax/levy pass-through.
Redline: Make the 5% CPI cap perpetual across all renewals; delete the 3% floor; confirm (via #2 precedence) the Special Terms expressly override Cl. 5.5.

11) Payment / suspension on non-payment (Cl. 5.8)
Quote: "...not paid by the Customer within 14 days of the due date then... the Service Provider reserves the right (subject to giving... not less than a further 7 days' notice) to deny the Customer access to the Data Centre or to the Services..."
Favours: Service Provider. Severity: High.
21 days from due date to full lockout of a live colocation deployment. There is also no express bar on suspending for a disputed amount.
Redline: 30-day cure from due date; no suspension where the sum is bona fide disputed under Cl. 5.3; require simultaneous escalation notice.

12) Deposit — open-ended, non-segregated, retained on early termination (Cl. 5.10-5.11; Special Terms)
Quote (5.11): "...if the customer terminates the contract early, service provider reserves the right to retain the deposit to cover any incurred damages, outstanding payments, or other costs associated with the early termination." (5.10): "The deposit will roll over and remain applicable with each automatic renewal... held until the final termination..." Special Terms: "Deposit + 1st Months rent payable on signing = $303,548.72."
Favours: Service Provider. Severity: High.
SP sets the deposit level unilaterally (Cl. 5.10), may spend it on hardware, holds it indefinitely through every auto-renewal, and may keep all of it as an unquantified penalty on early termination — with no requirement to prove actual loss and no fault distinction.
Redline: Segregate the deposit; return with interest on expiry; on early termination return the balance after deduction of actual, documented, reasonable costs only; no retention where Customer terminates for SP breach.

13) Term / 90-day notice + auto-renewal (Cl. 9.5; "Extended Term" undefined)
Quote: "...each Order shall expire unless it is otherwise stated in the Order to continue for an Extended Term... provided that either the Service Provider or the Customer may elect for that Order to terminate on the expiry of the Initial Term or... each Extended Term by giving notice in writing... not less than 90 days before the expiry..."
Favours: Service Provider. Severity: High.
A 90-day look-back to escape renewal is long and easy to miss; miss it and you roll into a further Extended Term (length set in the Order). "Extended Term" length is whatever the Order says — open-ended.
Redline: Cut exit notice to 30-45 days; require SP to send a renewal reminder 60 days pre-expiry; cap each Extended Term at 12 months.

14) MSA vs Order termination linkage (Cl. 9.2-9.3)
Quote: "Termination of this Master Services Agreement shall not automatically terminate all Orders then in force, which shall continue subject to their own terms..."
Favours: Service Provider. Severity: Medium.
You can terminate the MSA on 90 days' notice (9.1) yet remain bound under every live Order — so the headline "90-day termination right" is largely illusory while Orders run.
Redline: Allow Customer to terminate Orders for convenience on notice (with a fair, capped early-termination charge), or align Order termination with MSA termination.

15) Assignment asymmetry (Cl. 13)
Quote: Customer "shall not... assign, novate, transfer, sub-contract... without the prior written consent of the Service Provider." vs "The Service Provider may assign the benefit... and/or novate... to any third party by way of a novation agreement... and the parties hereby agree to enter into and execute such novation agreement..."
Favours: Service Provider. Severity: Medium.
EdgeMode can hand the whole contract to an unknown third party and you are pre-committed to sign the novation; you cannot even assign to a Group Company without SP approval.
Redline: SP assignment only to a party of equal/greater covenant strength and with no degradation of Services; permit Customer Group-Company assignment on notice only.

16) Lender direct-agreement / cure-rights (Colo Schedule Cl. 5.13)
Quote: "...to enter into an agreement with any funder or lender of the Service Provider (Lender) in the Lender's standard form... (c) to provide that the Customer may not exercise any rights of termination under the Relevant Contract unless such notice of default has first been served on the Lender and the breach or default has not been remedied within the relevant cure period."
Favours: Service Provider / its Lender. Severity: High.
You must sign an unknown third party's standard-form document that strips/delays your termination rights, on 14 days' demand, for no consideration.
Redline: Delete, or limit to a single pre-agreed form appended to the MSA with no extension of cure periods beyond the existing 30 days.

17) Service credits as sole and exclusive remedy (Annex 2 cl. 5.1; cl. 4.2)
Quote: "The Service Provider's entire liability to the Customer and the Customer's sole and exclusive remedy against the Service Provider in respect of a Critical Outage, Water Cooling Outage and Humidity Outage... regardless of the form of action, whether in contract, tort (including negligence...)... is as set out in this Annex 2." Credits run 2%-100% of the Monthly Charge for the racks.
Favours: Service Provider. Severity: High.
For the core risk on a colo deal — power/cooling failure — your only money remedy is a percentage discount on rack charges. Equipment damage, downtime, business loss: all barred. The one real lever is the termination right at Annex 2 cl. 6 (5+ unrelated Critical Outages in 12 months), which is a genuine (and unusually customer-friendly) protection worth preserving.
Redline: Make service credits a non-exclusive remedy; let damage caused by SP negligence fall under the Cl. 8.3 cap; expressly preserve the Annex 2 cl. 6 termination right.

18) Warranty disclaimer / entire-agreement reliance waiver (Cl. 14.1, 14.6)
Quote (14.6): "All warranties, terms and conditions and representations not set out in this Master Services Agreement, whether implied by statute or otherwise, are excluded to the extent permitted by law." (14.1): "...waives all rights and remedies which might otherwise be available to it..." The only positive standard is Cl. 3.2: Services performed "with reasonable care and skill."
Favours: Service Provider. Severity: Medium-High.
All implied warranties (fitness for purpose, etc.) stripped; reliance on pre-contract representations waived (fraud carve-out preserved). The substantive service promise is thin ("reasonable care and skill") and is further hollowed by the broad excused-performance list in Cl. 3.3 (maintenance, repair, "works being carried out").
Redline: Preserve mandatory statutory warranties; tighten Cl. 3.3 excuses to genuinely unavoidable works on reasonable notice.

19) IP ownership (Cl. 11)
Quote: "This Master Services Agreement shall not be deemed to assign to any party any Intellectual Property Rights belonging to the other. Each party retains all of its own Intellectual Property Rights..."
Favours: Neutral. Severity: Low.
This is fine for a colo deal — each side keeps its own IP. No grab of Customer IP. No issue to redline; noted for completeness.

20) Publicity (Cl. 12.2-12.3)
Quote: "The Service Provider may refer to the Customer as being a customer... in any oral marketing or sales communications... without [needing consent]." Written use needs consent "not... unreasonably withheld."
Favours: Service Provider. Severity: Low.
Oral name-drop allowed with no consent.
Redline: Require consent for any public use of CUDO's name/marks.

21) Notices — email failure trap (Cl. 15.3)
Quote: "An automated response... that the e-mail has not reached the intended recipient, or that the recipient is out of the office or some other error message... is sufficient to show that the e-mail notice has not been received and shall invalidate the service..."
Favours: whoever is NOT serving. Severity: Low-Medium.
An out-of-office auto-reply can invalidate your termination/dispute notice — a real trap for Customer-served notices (e.g., the 90-day renewal exit).
Redline: Deem email served on send absent a hard bounce; do not let OOO replies defeat service.

22) Data protection (Cl. 18)
Quote: "...neither party is a data processor of the other's personal data but both act as data controllers... Unless a data processing agreement has been entered into... the Customer agrees that it is responsible for ensuring that it will not disclose or otherwise expose the Service Provider to the Customer's Personal Data..."
Favours: Service Provider. Severity: Medium.
No DPA in place; all data-exposure risk sits on Customer, despite EdgeMode running CCTV/access-logging (Annex 1) that may capture personal data. A normal controller-controller / processor DPA is ABSENT.
Redline: Append a DPA; address EdgeMode's incidental processing (CCTV, access logs) with security and GDPR obligations.

23) Electricity admin mark-up + discretionary levy allocation (Annex 3 cl. 2.2, cl. 4)
Quote: "MAF is 1.05 being the Service Provider's monthly administration fee..." and (cl. 4) "the Customer shall pay... a fair proportion (as determined by the Service Provider (acting reasonably)) all Energy Levies..."
Favours: Service Provider. Severity: Medium.
5% admin uplift on all electricity (note this sits OUTSIDE the liability cap base per Cl. 8.3) and SP-determined "fair proportion" of levies. The reconciliation/no-mark-up-on-unit-cost mechanic (cl. 3) and the audit right (one free audit/yr) are reasonable and worth keeping.
Redline: Cap or fix the admin fee; allocate Energy Levies strictly pro-rata to actual consumption, not SP discretion.

24) Relocation right (Colo Schedule Cl. 12)
Quote: SP may "on not less than 3 months' written notice... require the Customer Equipment to be moved..." (SP bears relocation cost).
Favours: Service Provider. Severity: Low-Medium.
SP can force a physical move of your kit; cost is on SP and consultation is required, which mitigates.
Redline: Add a Customer right to refuse if the move materially degrades Service Levels or connectivity.

==================================================
THE 3 DEAL-BREAKERS I WOULD NOT SIGN
==================================================

1) The liability floor vs. the credits ceiling (Cl. 8.5 + Annex 2 cl. 5.1, with Data loss excluded at Cl. 8.2).
A €50,000 super-cap on MSA-level claims against a ~$303k signing payment, while the only remedy for the very failure you fear — power/cooling outage — is a rack-charge discount, and Data loss is excluded as a head of damage. The economics are unacceptable. Must raise the cap, make credits non-exclusive, and protect Data loss.

2) The forced Lender direct agreement (Colo Cl. 5.13).
Signing an unknown third party's "standard form" that suspends your termination rights and extends cure periods, on 14 days' demand, for no consideration. Delete or tightly pre-agree.

3) Punitive early-exit lock-in: One-Off Charge acceleration (Cl. 3.4) + unconditional deposit retention (Cl. 5.11) + 90-day auto-renewal trap (Cl. 9.5).
Together these mean any early exit — even for EdgeMode's breach — triggers full equipment acceleration plus forfeiture of a self-sized, indefinitely-held deposit, and you stay locked in unless you catch a 90-day window. Needs fault carve-outs, deposit reconciliation to actual loss, and a shorter exit notice with a renewal reminder.

One credit to EdgeMode for balance: the multiple-Critical-Outage termination right (Annex 2 cl. 6 — terminate after 5+ unrelated Critical Outages in 12 months, immediate, no notice period) is a genuine Customer protection and should be preserved unchanged in any redline.
