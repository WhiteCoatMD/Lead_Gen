# Twin City Fence — citation audit and correction list

Audited 2026-09-21, after the website and Google Business Profile were brought
into agreement. Every correction below is a change *someone has to make by
hand* in that directory's own dashboard — none of it can be automated, and a
citation service would only re-submit the same data, not fix what is already
published.

## The canonical record

Everything else has to match this. It is the Google Business Profile, because
that is what Google matches citations against.

| Field | Value |
|---|---|
| Name | **Twin City Fence** (singular) |
| Street address | **do not publish — see below** |
| City | West Monroe, LA 71292 |
| Phone | 318-351-2539 |
| Website | https://twincityfences.com |
| Email | twincityfences@gmail.com |

## The address is the important part

Four citations publish **205 Mane St, Suite C**. The Google Business Profile
deliberately does not, because another fence company operates at that address
and the conflict suppressed the listing until the address was hidden.

That makes this a service-area business, and the correct NAP for one is **name
+ phone + service area, with no street address**.

Publishing the street address on citations works against the fix: it keeps
feeding Google the association between this business and an address shared
with a competitor in the same trade. It is also why the profile does not
appear in the Places API at all.

**So the correction is to remove the street address where the directory
allows it, keeping West Monroe, LA 71292.** Where a directory insists on a
street address, leaving it is not a disaster — but it should not be added
anywhere new.

This reverses what the first version of the property record said. It had the
missing address logged as a defect to fix, which was exactly backwards.

## Corrections, most valuable first

### 1. Yelp — two problems
- Listed as **"TWIN CITY FENCES"**. Should be **Twin City Fence**.
- Publishes **"over 20 years experience"**. That claim appears nowhere the
  business itself says it — not the website, not the profile, not the archived
  site. It may well be true, but it is currently an unverifiable claim sitting
  on a third-party listing, and it is the kind of thing that has to come off
  or be substantiated. **Confirm it before it gets repeated anywhere else.**
- Address: 205 Mane St Ste C → remove, keep West Monroe, LA 71292.

### 2. ChamberofCommerce.com
- Listed as "Twin City Fences" → **Twin City Fence**.
- Shows West Monroe, LA 71292 already, no street address. Nothing else to do.

### 3. MapQuest
- Listed as "Twin City Fences" → **Twin City Fence**.

### 4. YouTube — I had this wrong, and it needs more than a rename

Checked directly at `youtube.com/@twincityfence`. The channel title is already
**"Twin City Fence "** — singular, correct, but with a **trailing space**.
Citations key on exact-string matching, so the space is worth removing even
though it looks like nothing.

The real problem is that the channel carries **no NAP at all**:

| Field | Now |
|---|---|
| Description | **empty** |
| Website link | **none** |
| Phone | **not shown** |
| Location | **not shown** |

As a citation it currently contributes nothing. My audit listed it as a name
fix based on a Google search snippet reading "Twin City Fences"; the live
channel says otherwise. Checking the source beat trusting the snippet.

**Description to paste** — every claim in it is already published on the site
or the profile:

> Twin City Fence builds wood privacy, chain-link, split rail, ornamental,
> farm and commercial fencing across Monroe, West Monroe and Ouachita Parish,
> Louisiana. We also fit gates, replace fences, and repair storm damage.
>
> Call 318-351-2539
> twincityfences.com

Also set the channel link to `https://twincityfences.com` and the business
email to `twincityfences@gmail.com`. No street address, for the reason above.

### 5. Facebook — name is right
- Listed as "Twin City Fence | West Monroe LA". Name matches, phone matches.
- Publishes 205 Mane St Suite C → remove the street address, keep the city.
- 770+ followers, so this is the most-seen citation after Google. Worth
  getting exactly right.

### 6. Porch
- Listed as "Twin City Fence". Name matches. Nothing to correct.

## Scorecard

| | Now | After corrections |
|---|---|---|
| Name matches the profile | 3 of 6 | 6 of 6 |
| Street address consistent with the profile | 2 of 6 | 6 of 6 |
| Phone matches | 6 of 6 | 6 of 6 |

The phone has been right everywhere all along, which is the field that matters
most for a business whose leads arrive by telephone. The name is the field
that is wrong nearly everywhere, and the one Google uses to decide whether two
listings describe the same business.

## What NOT to do

- **Do not buy a citation-building package for this business yet.** Six
  citations already exist and four of them are wrong. Adding forty more before
  fixing six means paying to spread the error.
- **Do not create new listings with the street address.** See above.
- **Do not repeat the "20 years" claim** anywhere until it is confirmed.

## Then, and only then

Once the six are consistent, the directories worth adding for a North
Louisiana fence contractor are the ones a real customer or supplier might
actually use: Angi, Thumbtack, BBB, Nextdoor, the Monroe Chamber of Commerce,
and any supplier "find an installer" page the business qualifies for. That is
a short list on purpose. Volume is not the point; agreement is.
