# SHERPA demo: three lifts, three ways to win

A walkthrough for a manager. It follows three opportunities, one for each line of business, from the first sighting to a signed contract. It uses the v2 flow (section 9 of `snap-to-deal-flow.md`): one area rep gets every lead and sends a technician, the manager qualifies and assigns the NI, EI or MOD rep, the manager generates every quotation and bid, and every win ends in a contract.

| Story | Line | The opportunity | Ends with | Time |
|---|---|---|---|---|
| **1** | Modernisation (MOD) | An old Schindler lift in a shopping centre, snapped by an employee | Signed modernisation contract, job with the installation team | 15 min |
| **2** | Existing installation (EI) | A competitor's lift whose owner is unhappy with the service | Signed 3-year maintenance contract, won from a competitor | 10 min |
| **3** | New installation (NI) | A building site with no lifts yet, then a formal tender | Bid built by legal, tender won, contract signed, job handed over | 12 min |

Each person sees only their own next step, and SHERPA is the intelligent layer in every step: it routes, prefills, suggests, scores, drafts, reviews and checks. People confirm or change; nobody picks from a dropdown or types what we already know.

> **Everything in the demo is simulated.** Customers, their replies, emails, e-signatures, tender documents, the legal team's progress and the agents' output are mocked in the browser. No real customer data is used and nothing leaves the app.

---

## The one-line pitch

**Any Schindler employee who sees a lift opportunity can turn it into a lead in under a minute. SHERPA sends it to the area rep, who sends a technician; it scores the lead from the visit, the manager hands it to the right team rep, and SHERPA takes it through a quotation or a tender bid and a contract to the installation team.**

## The problem we are solving

| Today | With SHERPA |
|---|---|
| Opportunities seen in the field are lost: no easy way to report them, no feedback to the person who saw it | Snap a photo, answer a few taps, get points and follow the lead to the result |
| The manager sorts a raw inbox by gut feel | One area rep per area takes every lead and sends a technician; only checked leads scoring 45 or more reach the manager |
| Team reps spend days on site visits | Technicians do the visits; NI, EI and MOD reps start only on qualified deals, with the installation, tender or quotation work |
| Field forms ask for what we already know | Lift and floor counts come from our records or the building register; the technician confirms them or counts from a photo |
| Every choice is a dropdown and a guess | SHERPA suggests the installation type, the people, the discount, the term and the reasons, from our history, and shows why |
| Weak leads are deleted and forgotten | Below 45 they wait in **Nurture** and are rescored when new facts arrive |
| Quotations are written in Word and reviewed by email | The Pricing Expert agent writes the quotation; the manager sets the discount and sends it. The Contract agent does the contract; people only follow the status |
| Tender bids are chased by email with legal | The NI rep gathers, the manager clicks **Start the bid** and follows the legal team's progress on the deal; quotations show the Pricing Expert agent's progress the same way |
| Handovers between sales, support, the manager and installation are invisible | One deal record from lead to contract; everyone sees who is doing what |

---

## Before the meeting (5 minutes)

1. Start the app: `npm run dev`, then open `http://localhost:3000` (SHERPA) and `http://localhost:3000/snap` (Snap & Lead) in two tabs.
2. Avatar menu → **Demo controls** → **Reset demo data**. Reset once: the three stories use different deals, so they can run back to back.
3. Have two lift photos and any PDF ready on the laptop (the PDF is the tender document Timo gets on site in Story 3).
4. Optional: make the window narrow for the technician scenes to show the phone layout.

**Switching people:** the avatar menu (or the bar under the phone in Snap & Lead) → **Switch role**. Every list is sorted newest first, so the story's deal is the **top row**.

## What's in the demo data

Kept small on purpose: every lead was snapped by Lukas, every building name is used once (except Sihl Riverfront, which also has last year's lost bid as history), and every deal sits at a different step. Stories 1 and 2 are created live; nothing for them is seeded.

| Who | Waiting in their list | Step it shows |
|---|---|---|
| Laura Kunz | *Send a technician: Sihl Riverfront* | Story 3 starts here |
| Jan Widmer | *Check the site visit: Albisrieden Gardens* | A report SHERPA held (tender or quotation not known yet) |
| Jan Widmer | *Send a technician: Altstetten Phase 3 Commercial Tower* | A tender the radar found |
| Timo Graf | *Site visit: Schlieren Grand* | A visit to file |
| Marco Bianchi | *Review: Höngg Residenz*, *Review: Eulach Medical Centre* | Lead review (new building, existing lift) |
| Marco Bianchi | Lead review → **Nurture**: *Grünau Heights* | Below the score threshold |
| Sophie Keller | *Gather the quotation information: Dietikon Crest* | Quotation path |
| Sophie Keller | *Gather the bid information: Zurich West Tower 4* | Tender path |
| Marco Bianchi | *Generate the quotation: Glattbrugg Metro Plaza*, *Limmat Office Park, Tower A* (modernisation) | Pricing Expert agent next |
| Marco Bianchi | *Start the bid: Hardbrücke One* | Bid ready to start |
| Marco Bianchi | *Bid with the legal team: Stadelhofen Square*, *Wallisellen Signature* | Legal in progress; one already submitted |
| Anna Fischer | *Follow up: Seefeld Tower*, *Oerlikon Business Hub* | Quotations with the customer |
| Marco Bianchi | *Contract with the Contract agent: Wollishofen Gateway* | Contract agent at work |
| Stefan Baumann | *Accept the job: Wiedikon Meadows* | Won, hand-over |
| Service, emergency, records | One each: a fault at Oerlikon Station Concourse, an emergency at Stadthaus Annexe, a missing lift at Oerlikon Business Hub | Non-sales leads |

## The cast

| Person | Role | In stories |
|---|---|---|
| **Lukas Meier** | Any Schindler employee (the reporter), Snap & Lead | 1, 2 |
| **Laura Kunz** | Area sales rep, Zurich City and North: gets every lead there | 1, 3 |
| **Jan Widmer** | Area sales rep, Zurich West and Winterthur: gets every lead there | 2 |
| **Timo Graf** | Field technician, Zurich West and City: every site visit | 1, 2, 3 |
| **Mia Steiner** | Modernisation sales rep, Zurich | 1 |
| **Erik Huber** | Existing installation sales rep, Zurich West | 2 |
| **Sophie Keller** | New installation sales rep, Zurich | 3 |
| **Marco Bianchi** | Sales Manager, Zurich region | 1, 2, 3 |
| **Anna Fischer** | Sales support: follow-ups and contract checks | 1, 2, 3 |
| **Stefan Baumann** | Service lead (installation team) | 1, 3 |
| **Lena Wolf** | Account manager | 1 |

---

# Story 1 · Modernisation: an old lift in a shopping centre becomes a signed contract

### Scene 1. Lukas snaps a lift — *Snap & Lead, Lukas Meier*

**Say:** "Lukas isn't in sales. He's at Bahnhofplatz Galerie and notices an old lift. Today that thought dies there."

**Click:**
1. **Take or upload photos** → add two photos → tag one **Elevator** → **Analyse**.
2. **Search for a building** → **Bahnhofplatz Galerie, Block B** → brand **Schindler** → **Yes, looks right**.
3. Unit **61102** · **Minor issues** · why: **It looks old or worn** → **All of it** · **Ours (Schindler)** · **2 to 4** · contact *Simone Gerber, centre manager*.
4. **Review the lead** → **Create lead**.

**They will see:** SHERPA checks our records. Unit 61102 is 27 years old, so it guesses **Modernisation**. Lukas’s summary says **Goes to: Area sales rep**, not a team: the team is decided later, by the manager. In SHERPA the lead lands with **Laura Kunz**, the area rep for Zurich City. Every lead in her area goes to her, whatever the team.

**Show:** **My leads** → top row. The tracker has the same steps as the deal in SHERPA: **Submitted → With the area rep → Site visit → Manager review → Quotation or bid → Won → Contract → Work initiated**, now at *With the area rep*. Come back to it after Scene 3 and again at the end: it moves as the deal moves, and Lukas gets a notification at each step.

**Point to make:** "A few taps, no forms, no sales knowledge needed. Lukas never has to know which team gets it; he just sees his lead move."

### Scene 2. The area rep sends a technician — *Laura Kunz, then Timo Graf*

**Click (Laura):** **My work** → top row *Send a technician: Bahnhofplatz Galerie, Block B*.

**They will see:** one action on top: **Timo Graf** marked **SHERPA's pick** (hover it: covers Zurich City, visits filed in the area, open tasks), and **Send Timo**. **Change** lists the other technicians with their numbers; there are no dropdowns. Below it, what Lukas told us.

**Click (Laura):** **Send Timo**.

**Click (Timo, phone):** **My visits** → top row:
1. Met *Simone Gerber, Centre manager* · **Wear and small faults** · **The person I met** · **Now**.
2. **They will see:** lifts and floors already filled, each with its source. Floors come from the federal building register. Lifts are flagged: Lukas said "2 to 4", but our records list only unit 61102.
3. Lifts → **Photo of the lift lobby** (any photo) → SHERPA counts the doors. Floors → **Looks right**.
4. **File the site-visit report**. Until the required answers are in, the bar at the bottom says what is still needed instead of showing a dead button.

**Point to make (Timo):** "The technician never types a number we already have. Each count shows where it came from, and is confirmed, nudged with − / +, or counted from a photo."

**They will see (Laura):** no step for her. Nothing was missing, so SHERPA sent the report straight to Marco and told her so (bell). Laura only gets *Check the site visit* when SHERPA holds a report: something missing, nobody knows yet if it is a tender, the tender document not shared, or a score below 45. She never picks the installation type: SHERPA works it out for Marco.

**They will see:** SHERPA scores the complete lead out of 100. At 45 or more it goes to Marco; below that it waits in Nurture.

**Point to make:** "The manager never sees a half-empty lead, and no team rep has driven to a site yet. The area rep and a technician did the groundwork."

### Scene 3. The manager qualifies — *Marco Bianchi*

**Click:** **Lead review** (opens by default) → top row *Bahnhofplatz Galerie, Block B*.

**They will see:** the decision first. Installation type **Modernisation · SHERPA suggests**, **Mia Steiner** as **SHERPA's pick** for the MOD rep (hover it: her win rate on modernisation deals, wins in the area, open tasks; **Change** to pick someone else) and **Qualify for MOD** sit right under the title, with the score in the top-right corner. Below, **SHERPA suggests Modernisation** with its reasons (unit 25 years or older, past the usual 20-year upgrade point; what Timo found), its insight and the site-visit facts (*Site visit by Timo Graf, checked by Laura*).

**Show:** hover the score: every point and where it came from (the unit's age, the condition, history in the area, the site-visit answers). Click **Send back to Laura** and **Reject** to show they only open a field when needed (a reject needs a reason, and the reason trains the score), then close them again.

**Click:** **Qualify for MOD**. The deal moves from Laura to Mia.

**Point to make:** "One decision per lead: is it worth it, and which team rep takes it. It is the first thing on the screen. The detail is there when he wants it, not in the way."

### Scene 4. The rep gathers, the agent drafts, the manager sends — *Mia, then Marco* ★

1. **Mia:** **My work** → top row *Set up the deal for …*. The customer reads **Bahnhofplatz Retail AG · SHERPA suggests** (hover: same building in our records, and who owns the account) → **Start the quotation** → **1,000 kg (13 persons)** · **1.75 m/s** · **Controller and drive** · **Now** → **Send to Marco**.
2. **Marco:** **My work** → top row *Generate the quotation* → **Generate quotation**.
3. **They will see:** the step turns into *The Pricing Expert agent is drafting OF-…*, with a progress bar and five steps: *Reading the gathered information* → *Comparing recent wins in the area* → *Pricing the lifts and options* → *Writing the quotation* → *Quotation ready to check*. Marco has nothing to do yet. → **Pricing agent finished (demo)**.
4. **Marco:** **Open OF-…** → set the discount to **12%** → **Mark ready to send** → **Write the email** → **Send to customer**. No approval round: he is the approver.

**Point to make:** "The rep collects the facts, the agent prices and writes, the manager watches it happen, then decides and sends. No Word file, no email attachments, and one person owns the price."

### Scene 5. Sales support follows up — *Anna Fischer*

**Click:** **My work** → top row *Follow up with Bahnhofplatz Retail AG on OF-…*.

**They will see:** **Customer approved**, **Send a reminder**, **Open OF-…** and **Customer said no** on top, then the offer, price, discount and when Marco sent it. After 14 quiet days SHERPA suggests a reminder or a revised offer here.

**Show:** **Customer said no** opens with the likely reason already filled (**SHERPA suggests**: the most common loss reason in the area). Close it again.

**Click:** **Open OF-…** → answer the customer's questions in the chat → when the customer agrees, **Customer approved: draft the contract**.

**They will see:** the deal moves to **Contract** and the Contract agent drafts it from the accepted quotation.

### Scene 6. The contract — *Marco*

**Click:** **My work** → top row *Contract with the Contract agent: …*.

**They will see:** one box with the contract (value, term, start, payment plan, scope, signer) and, right under it, the Contract agent's progress: *Details gathered from the deal* → *Contract drafted* → *Terms checked by the Contract Risk Reviewer* → *Sent to the customer for e-signature* → *Signed by the customer*. Nobody edits a draft; the agent does the paperwork.

**Click:** **Customer signed (demo)**. The contract is **Signed** and the deal is **Won**.

### Scene 7. Hand-over and closing the loop — *Stefan, Lena, Lukas*

1. **Stefan Baumann:** **My jobs** → top row. Start date (from the contract), site contact (from the deal) and **Accept the job** in one row; the **hand-over pack** from the signed contract below it, with the papers folded away → **Accept the job**.
2. **Lena Wolf:** **Accounts** → *Bahnhofplatz Retail AG*. The modernisation line is active and the signed contract is listed.
3. **Lukas**, `/snap`: **My leads** → top row: every step ticked through **Won → Contract → Work initiated**, **Won, +275 points**.

**Point to make:** "The person who took the photo sees it become a signed deal. That's what makes people report the next one."

---

# Story 2 · Existing installation: winning a competitor's lift

**The idea:** a lift serviced by a local firm, in a building that is already our customer. The owner is unhappy. SHERPA spots the opening, the rep picks the offer that usually wins, and the deal ends as a 3-year maintenance contract taken from a competitor.

### Scene 1. Lukas snaps another company's lift — *Snap & Lead, Lukas Meier*

1. **Take or upload photos** → add two photos → tag one **Elevator** → **Analyse**.
2. **Search for a building** → **Altstetten Tech Park, Tower 2** → **Another brand** → type **Otis 55120** → **Yes, looks right**.
3. **Minor issues** · who services it: **A local firm** · lifts: **5 or more** · person in charge: **A facility manager** · contact *Daniel Müller, facility manager, 079 123 45 67*.
4. **Did you speak to them?** **Yes, open to a call** · **Happy with their service company?** **Unhappy**.
5. **Review the lead** → **Create lead**.

**They will see:** Lukas's summary says **Goes to: Area sales rep**, even though SHERPA already suspects a win-back. In SHERPA it lands with **Jan Widmer**, the area rep for Zurich West. Lukas sees what he earns at each step.

### Scene 2. The area rep and the technician — *Jan Widmer, then Timo Graf*

1. **Jan:** **My work** → top row *Send a technician* → **Send Timo**.
2. **Timo:** **My visits** → top row → met *Daniel Müller, Facility manager* · **Wear and small faults** · **The person I met** · **Within 3 months** · lifts and floors prefilled: **Looks right** on each · servicer *local firm, owner unhappy* → **File the site-visit report**.
3. Nothing missing, so SHERPA sends it straight to Marco. Jan only gets a note.

**Point to make:** "Same routine in every area, whatever the lift: the area rep sends a technician and checks the report, and SHERPA works out the installation type. Erik hasn't spent a minute on it yet."

### Scene 3. The manager sees why it matters — *Marco Bianchi*

**Click:** **Lead review** → top row *Altstetten Tech Park, Tower 2*.

**They will see:**
- a warning banner: **Why we lost here last time**, with the reason;
- the decision on top: installation type **Existing installation · SHERPA suggests** (a working lift, owner unhappy with the servicer: a win-back offer), **Erik Huber** as SHERPA's pick for the EI rep, score in the corner (hover it: another company's lift, open to a call, unhappy with the servicer, the site-visit points);
- below: **SHERPA suggests Existing installation** with its reasons, the insight (already a customer, how similar quotes in the area went) and Timo's site-visit facts.

**Click:** **Qualify for EI**. The deal moves to Erik.

### Scene 4. The rep picks the offer, the manager generates it — *Erik, then Marco* ★

1. **Erik:** **My work** → top row. SHERPA's offers are one row each, the recommended one highlighted: **3-year maintenance, 10% off** ("a first-year discount is the usual way in") and **1-year trial at list price** → **Pick this offer** on the 3-year option.
2. **Marco:** **My work** → top row → **Generate quotation** → the Pricing Expert agent's progress → **Pricing agent finished (demo)** → **Open OF-…**.
3. **Marco:** discount **15%**, since we lost here to a competitor's offer before → **Mark ready to send** → **Write the email** → **Send to customer**.

**Point to make:** "The rep didn't need to know the playbook for winning a competitor's customer. SHERPA proposed it, "

### Scene 5. Follow-up and contract — *Anna, Marco*

1. **Anna:** top row → **Open OF-…** → answer *"How fast do you respond?"* (*"Within 4 hours, all days."*) and *"Can you start next month?"* (*"Yes."*) → **Customer approved: draft the contract**.
2. **Marco:** top row *Contract with the Contract agent* → the contract and its progress in one box → **Customer signed (demo)**. A **3-year maintenance contract, signed**.

### Scene 6. Lukas sees the result — *Snap & Lead*

**My leads** → top row *Altstetten Tech Park, Tower 2*: the tracker went through the same steps as the deal, from *With the area rep* to **Won → Contract → Work initiated**. **Won, +275 points**.

**Point to make:** "We took a competitor's customer, starting from a photo taken by someone outside sales."

---

# Story 3 · New installation: a building site becomes a tender win

**The idea:** a building under construction where we lost a bid before. The area rep sends a technician, the manager qualifies it and assigns the NI rep, and a formal tender follows. The NI rep gathers the bid information, the manager starts the bid, the legal team builds and submits it, and the manager follows the progress and records the win. The win ends in a contract and a job for the installation team.

*Lukas spotted the site earlier. The lead is already in the demo data, waiting for Laura, the area rep, to send a technician.*

### Scene 1. The site visit — *Laura Kunz, then Timo Graf*

**Click (Laura):** **My work** → top row *Send a technician: Sihl Riverfront (building site)*.

**They will see:** **Why we lost here last time: Competitor offer was 9% lower**, before anything else.

1. **Laura:** **Send Timo**.
2. **Timo:** **My visits** → top row:
   - met *Claudia Brun, Project director* · **Shafts ready** · **Developer or contractor** · **This year**;
   - **How will they buy the lifts?** SHERPA has no tender on record for this site, so nothing is preselected: "Ask the person in charge". Claudia says it goes to tender → **Formal tender**;
   - **Upload the tender document** appears → **Upload the document** → any PDF (or **Photograph the pages**);
   - **They will see:** no lift or floor counts on a tender: the tender document has them;
   - **File the site-visit report**.

   The counts only appear when it is not a tender (a direct quotation, not known yet, or an existing building): prefilled from our records where we have them, confirmed with **Looks right** or a photo; on a new building site the technician counts.
**They will see:** SHERPA scores it **55**, over the 45 threshold, and sends it straight to Marco. Laura has no step: she only gets a note.

**Also show (optional):** Jan's top row, *Check the site visit: Albisrieden Gardens*. This is what a held report looks like: "SHERPA held it for you: nobody knows yet if it goes to tender." Jan checks with the developer, then **Send to the Sales Manager**, or **Send the technician again**.

**Point to make:** "The lesson from the lost bid is in front of the area rep on day one, not in someone's memory. And the tender document is in SHERPA before anyone in sales has touched the deal."

### Scene 2. The manager qualifies, and sees the nurture list — *Marco Bianchi*

**Click:** **Lead review** → top row *Sihl Riverfront* → **New installation · SHERPA suggests** (building site, site readiness, buys by formal tender: Timo on site), NI rep **Sophie Keller** → **Qualify for NI**. Sophie gets the deal.

**Also show:** the **Being scouted** tab (leads still with the area reps and technicians) and the **Nurture** tab: *Grünau Heights* scored 35 and waits there. **Review it anyway** brings it to Marco if he wants it.

**Point to make:** "Weak leads are not deleted. They wait, and SHERPA scores them again when something new comes in."

### Scene 3. The rep gathers the bid information — *Sophie Keller* ★

1. **My work** → top row *Gather the bid information for T-…*. No "set up the deal" step: Timo's visit already said formal tender, so SHERPA opened the tender, matched the customer and read the document when Marco qualified it.
2. Sophie's step is only what SHERPA can't know. The document is not hers to send; it is already on the deal.
3. **They will see:** *Already on the deal: sihl….pdf, read by SHERPA* (folded; open it to show the facts with their pages). Below, questions only for what the document leaves open, then what only she can find out.
4. Answer **1,350 kg (20 persons)** · **Centre-opening, 2 panels** · **Stainless steel, hairline** · **24 months** → **What does the customer care about most?** **Delivery date** → **Who else is bidding?** type *KONE* → optional note for the legal team → **Ready for Marco to start the bid**.

**Point to make:** "Nobody retypes the tender. SHERPA reads it and asks only for the gaps. Sophie's job is to know the customer: what they care about and who we are up against."

### Scene 4. The manager starts the bid and follows legal — *Marco Bianchi* ★

**Click:** **My work** → top row *Start the bid for T-…*.

**They will see:** the discount as **SHERPA suggests** (hover: the area's average discount on similar quotes and our earlier loss here on price; **Change** shows the other steps) and **Start the bid** on top, with **Ask Sophie for more** as a link. Below, everything Sophie gathered: the tender, lifts, list value, days left, the document, her answers, what the customer cares about and who else is bidding.

**Click:** **Start the bid**.

**They will see:** the step becomes *Bid with the legal team*: a progress bar and the legal team's steps, *Handed to the legal team* → *Tender documents checked* → *Technical compliance and drawings* → *Price sheet and company papers* → *Signed and submitted in the tender*, each ticked with when it happened. Legal submits the bid; Marco never handles the file.

**Click:** **Legal submitted the bid (demo)**. Only **Won** and **Lost** are left for Marco → **Won**. (Show **Lost** too: the reason comes prefilled as **SHERPA suggests**, from the losses in the area and the last loss here, and it feeds Win/Loss Insights.)

**Point to make:** "Marco decides when to bid and at what discount; legal builds it. No status emails: he sees the progress on the deal itself, and only his next click is on top."

### Scene 5. Contract and hand-over — *Marco, Stefan*

1. **Marco:** top row *Contract with the Contract agent* → the contract and the agent's progress in one box → **Customer signed (demo)**.
2. **Stefan Baumann:** **My jobs** → top row → **Accept the job**. The hand-over pack has the customer, site contact, lifts, the signed contract and every paper; the start date comes from the contract.

**Point to make:** "From a building site we once lost, to a signed contract with the installation team. Every handover is visible and nothing is retyped."

---

## Encore (optional, 3 min): where the next deal comes from

- **Account management, Lena Wolf:** **Accounts** → *Bahnhofplatz Retail AG* → Next best actions → **Raise for review** on "Win the service on 1 unit serviced by others".
- **Marketing, Martina Vogel:** **Marketing** → **New campaign** → goal **Modernisation** → **Draft the message with SHERPA** → **Save the campaign** → **Send to … contacts** → **Simulate a day of replies (demo)** → **Leads** → top row → **Send to the Sales Manager**.

**Point to make:** "Field reports, account plans and campaigns all feed one queue, one scoring model and one process."

---

## How the three stories differ

| | Modernisation | Existing installation | New installation |
|---|---|---|---|
| Where the lead comes from | Our old lift, snapped | A competitor's lift, snapped | A building site, spotted earlier |
| Who handles the lead before the manager | Laura (area rep) and Timo | Jan (area rep) and Timo | Laura (area rep) and Timo |
| Who the manager assigns | Mia (MOD) | Erik (EI) | Sophie (NI) |
| What SHERPA knows up front | The unit's age from our records | We lost here before; the owner is unhappy | We lost a bid here: competitor 9% lower |
| What the technician brings back | Lift count settled from a photo | Site facts confirmed with **Looks right** | Formal tender and the tender document; no counting, the document has it |
| What gets generated | Quotation by the Pricing Expert agent | Maintenance quotation from the offer the rep picked | Bid by the legal team with the Tender agent |
| Who follows up | Sales support | Sales support | The manager, through the tender |
| How it ends | Contract, job for the service lead | 3-year maintenance contract | Contract, job for the service lead |

## What to stress

1. **Area rep and technician first, then manager, then team rep.** The manager only sees visited and scored leads; the rest wait in Nurture. A complete site visit goes to the manager by itself; the area rep only steps in when SHERPA holds one. NI, EI and MOD reps spend their time on installations, tenders and quotations, not site visits.
2. **SHERPA suggests, people confirm.** No dropdowns in the steps: installation type, people, tender or quotation, discount, contract term, customer match, loss and reject reasons all come prefilled as **SHERPA suggests** with the reasons on hover. **Change** is there when someone knows better. Counts the technician would type come from our records and the building register.
3. **The next click is always on top.** Every step opens with its action; reasons and facts sit below, and the score's detail is a hover away.
4. **One record from first sighting to signed contract.** No re-keying between the reporter, the area rep, the technician, the team rep, the manager, support, legal and installation.
5. **The manager owns every price.** Reps gather; the manager starts the quotation or the bid; the Pricing Expert agent or the legal team builds it while he follows the progress; the manager sends it.
6. **SHERPA guides, people decide.** It routes, scores and reads tenders; agents write the quotation and the contract, and the legal team builds the bid. People decide and follow the status, and every change is logged.
7. **Our history is used.** Lost bids, earlier prices and win rates show up at the moment they matter.
8. **The reporter is never left guessing.** Lukas's lead goes to the area sales rep and its tracker follows the deal step by step: won, contract, work initiated (or lost or closed).

## Questions they may ask

| Question | Answer |
|---|---|
| Is the AI real? | In the demo, the agents, scoring, tender reading, legal status and reviews are simulated from rules and seeded data. Only the photo reader can call a real model, and only when a key is set. |
| Where does the data come from? | Seeded demo data for the Zurich region. In production: NewCRM, the installed-base records, the federal building register, and the tender portals. |
| Why does the legal team not log in? | They work in their own tools. SHERPA only shows the bid's status and the final document. |
| What happens below the threshold? | The lead waits in **Nurture** and is rescored when new facts arrive. The manager can still pick it up with **Review it anyway**. The threshold (45) is set in Admin. |
| Who decides between NI, EI and MOD? | SHERPA suggests it from the snap, our records (unit age) and the technician's findings, with its reasons. The Sales Manager decides when qualifying and can pick another type; the area rep doesn't choose. |
| What if no area rep covers an area? | The Sales Manager gets **Assign an area rep** with SHERPA's pick from a neighbouring area (by workload) and assigns in one click. |
| Does the technician use Snap & Lead? | No. Snap & Lead is only for reporting leads. Technicians work in SHERPA under **My visits**, where the site-visit report is. |
| What does the reporter see after sending? | "Goes to: Area sales rep", then a tracker with the deal's steps (area rep, site visit, manager review, quotation or bid, won, contract, work initiated) that moves with the deal. |
| How does SHERPA pick people? | From history: win rate on this kind of deal, wins in the area, earlier work with the customer, and today's open tasks. Technicians by visits filed in the area. Hover **SHERPA's pick** for the numbers. |
| Where do lift and floor counts come from? | The tender document, our installed-base records for that exact building, the federal building register (GWR) for floors of existing buildings, then the reporter's estimate. A building site has no record before its tender, so the technician counts it. In the demo the register and photo counting are mocked. |
| What if a building site has no tender? | The technician records **Direct quotation** on site, so SHERPA recommends **Quotation** and the button reads **Start the quotation**. The deal then follows the quotation path from Story 1. |
| Does it work on a phone? | Yes. Snap & Lead and the technician's visit form are built for the phone. |

## If something goes wrong during the demo

- **Lost your place:** switch to the person in the next scene; their top row is the story's deal.
- **Need a clean start:** avatar menu → **Demo controls** → **Reset demo data**, then begin the story again.
- **Short on time:** start live at the starred scenes (★). Every step of the new-installation path also has a seeded deal waiting (see chapter 4 in section 7 of `snap-to-deal-flow.md`), so you can show any step on its own.
