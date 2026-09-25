import type { Prisma } from "@/lib/generated/prisma/client";
import type { LeaseTemplateLanguage } from "@/lib/lease-template-options";

/**
 * A starting point per language, because the alternative is an empty HTML box
 * and a list of tokens — which is a format, not a contract. Someone writing
 * their organization's first template edits wording they recognise instead of
 * inventing structure from nothing.
 *
 * These are drafts to be adapted, not legal advice: the clauses are the
 * ordinary shape of a Tanzanian residential tenancy, and every organization is
 * expected to rewrite them to match what it actually agrees with its tenants.
 *
 * A starter is content only. How a contract is typeset lives in
 * `lib/lease-document-style.ts`, which the editor surface and the preview
 * iframe both read — a `<style>` block at the top of the body would be CSS the
 * author can see and delete from inside a WYSIWYG editor.
 */

const ENGLISH = `<div class="contract">
  <p class="ref">Contract No. {{contract_number}}</p>

  <h1>House Tenancy Agreement</h1>

  <p class="meta">This agreement is made on {{agreement_date}}</p>

  <h2>BETWEEN</h2>

  <p>
    <span class="party">{{landlord_name}}</span> of {{organization_name}},
    telephone {{landlord_phone}}, email {{landlord_email}} — hereinafter
    referred to as the <strong>LANDLORD</strong> (which expression shall
    include their heirs and all persons claiming under or on their behalf) of
    the one part.
  </p>

  <h2>AND</h2>

  <p>
    <span class="party">{{tenant_name}}</span> (telephone {{tenant_phone}},
    National ID / Passport {{tenant_id}}, nationality
    {{tenant_nationality}}) — hereinafter referred to as the
    <strong>TENANT</strong> (which expression shall include their heirs and all
    persons claiming under or on their behalf) of the other part.
  </p>

  <h3>WHEREAS:</h3>

  <ol>
    <li>
      The <strong>LANDLORD</strong> is the lawful owner of
      <strong>{{unit_name}}</strong> ({{unit_type}}, {{area_sqm}} sqm, floor
      {{unit_floor}}) at <strong>{{property_name}}</strong>, situated at
      {{property_location}}.
    </li>
    <li>
      The <strong>LANDLORD</strong> is willing to let the said premises to the
      <strong>TENANT</strong> on the terms set out in this agreement.
    </li>
    <li>
      The <strong>TENANT</strong> wishes and is willing to occupy the said
      premises for residential purposes only.
    </li>
  </ol>

  <h3>NOW THEREFORE THIS AGREEMENT WITNESSES AS FOLLOWS:</h3>

  <ol>
    <li>
      The <strong>LANDLORD</strong> lets the premises to the
      <strong>TENANT</strong> for a term of
      <strong>{{number_of_months}} months</strong>, beginning
      {{lease_start_date}} and ending {{lease_end_date}}.
    </li>
    <li>
      The <strong>TENANT</strong> shall pay rent of
      {{currency}} {{rent_amount}} per month, being
      {{currency}} {{total_amount}} for the whole term.
    </li>
    <li>
      The <strong>TENANT</strong> shall keep the premises and everything in
      them in good condition for the whole term, fair wear and tear excepted.
    </li>
    <li>
      The <strong>TENANT</strong> shall not sublet, assign or part with
      possession of the premises, in whole or in part, without the written
      consent of the <strong>LANDLORD</strong>.
    </li>
    <li>
      The <strong>TENANT</strong> shall pay for their own electricity, water
      and any other utility consumed on the premises during the term.
    </li>
    <li>
      The <strong>TENANT</strong> shall not make any structural alteration to
      the premises without the written consent of the
      <strong>LANDLORD</strong>.
    </li>
    <li>
      The <strong>LANDLORD</strong>, or a person authorised by them, may
      inspect the premises at a reasonable hour after giving the
      <strong>TENANT</strong> at least seven (7) days' notice.
    </li>
    <li>
      Either party may terminate this agreement by giving the other not less
      than one (1) month's written notice.
    </li>
    <li>
      On the expiry or termination of this agreement the
      <strong>TENANT</strong> shall vacate the premises and hand over all keys
      to the <strong>LANDLORD</strong>.
    </li>
    <li>
      Any dispute arising out of this agreement shall first be settled by
      negotiation between the parties, and failing that, in accordance with the
      laws of the United Republic of Tanzania.
    </li>
  </ol>

  <p>
    In the event of an emergency the <strong>TENANT</strong> may be reached
    through {{tenant_next_of_kin}} on {{tenant_next_of_kin_phone}}.
  </p>

  <p>
    <strong>IN WITNESS WHEREOF</strong> the parties have signed this agreement
    on the day and year first above written.
  </p>

  <table class="signatures">
    <tr>
      <td>
        <div class="signature-slot">{{landlord_signature}}</div>
        <strong>LANDLORD</strong><br />{{landlord_name}}
      </td>
      <td>
        <div class="signature-slot">{{tenant_signature}}</div>
        <strong>TENANT</strong><br />{{tenant_name}}
      </td>
    </tr>
    <tr>
      <td>
        <div class="rule"></div>
        Witness (name, signature, date)
      </td>
      <td>
        <div class="rule"></div>
        Witness (name, signature, date)
      </td>
    </tr>
  </table>
</div>`;

const SWAHILI = `<div class="contract">
  <p class="ref">Mkataba Na. {{contract_number}}</p>

  <h1>Mkataba wa Kupangisha Nyumba</h1>

  <p class="meta">Makubaliano haya yamefanyika leo tarehe {{agreement_date}}</p>

  <h2>BAINA YA</h2>

  <p>
    NDUGU <span class="party">{{landlord_name}}</span> wa
    {{organization_name}} (SIMU {{landlord_phone}}, BARUA PEPE
    {{landlord_email}}) ambaye katika mkataba huu atajulikana kama
    <strong>MPANGISHAJI</strong> (neno ambalo litamaanisha warithi wake, pia
    watu wote wanaoweza kudai chini yake au kwa niaba yake) kwa upande mmoja.
  </p>

  <h2>NA</h2>

  <p>
    Ndugu <span class="party">{{tenant_name}}</span> (SIMU {{tenant_phone}},
    NIDA {{tenant_id}}, URAIA {{tenant_nationality}}) ambaye katika mkataba huu
    atajulikana kama <strong>MPANGAJI</strong> (neno ambalo litamaanisha pia
    warithi wake na watu wote wanaoweza kudai chini yake au kwa niaba yake) kwa
    upande mwingine.
  </p>

  <h3>KWA VILE:</h3>

  <ol>
    <li>
      <strong>MPANGISHAJI</strong> ni mmiliki halali wa nyumba
      <strong>{{unit_name}}</strong> ({{unit_type}}, mita za mraba
      {{area_sqm}}, ghorofa {{unit_floor}}) iliyoko
      <strong>{{property_name}}</strong>, {{property_location}}.
    </li>
    <li>
      <strong>MPANGISHAJI</strong> yuko tayari kupangisha nyumba hiyo kwa
      <strong>MPANGAJI</strong> kwa makubaliano yatakayofikiwa katika mkataba
      huu.
    </li>
    <li>
      <strong>MPANGAJI</strong> anapenda na yuko tayari kupanga katika nyumba
      hiyo kwa shughuli za makazi tu.
    </li>
  </ol>

  <h3>HIVYO BASI, MKATABA HUU UNATHIBITISHA YAFUATAYO:</h3>

  <ol>
    <li>
      <strong>MPANGISHAJI</strong> anampangisha <strong>MPANGAJI</strong>
      nyumba kwa ajili ya kuishi kwa kipindi cha
      <strong>miezi {{number_of_months}}</strong> kuanzia tarehe
      {{lease_start_date}} hadi tarehe {{lease_end_date}}.
    </li>
    <li>
      Kwamba <strong>MPANGAJI</strong> atalipa kodi ya nyumba hiyo kwa
      <strong>MPANGISHAJI</strong> kiasi cha {{currency}} {{rent_amount}} kwa
      kila mwezi, ambayo ni sawa na {{currency}} {{total_amount}} kwa kipindi
      chote cha miezi {{number_of_months}}.
    </li>
    <li>
      Kwamba <strong>MPANGAJI</strong> atatunza nyumba na vyote vilivyomo kwa
      kipindi chote cha mkataba.
    </li>
    <li>
      Kwamba <strong>MPANGAJI</strong> hataruhusiwa kupangisha nyumba hiyo au
      sehemu yake kwa mtu mwingine bila idhini ya maandishi ya
      <strong>MPANGISHAJI</strong>.
    </li>
    <li>
      Kwamba <strong>MPANGAJI</strong> atalipa gharama zake za umeme, maji na
      huduma nyingine atakazotumia katika nyumba hiyo kwa kipindi chote cha
      mkataba.
    </li>
    <li>
      Kwamba <strong>MPANGAJI</strong> hatafanya mabadiliko yoyote ya ujenzi
      katika nyumba hiyo bila idhini ya maandishi ya
      <strong>MPANGISHAJI</strong>.
    </li>
    <li>
      Kwamba <strong>MPANGISHAJI</strong>, au mtu atakayemteua, anaweza kukagua
      nyumba hiyo kwa saa za kawaida baada ya kumpa <strong>MPANGAJI</strong>
      taarifa ya siku saba (7).
    </li>
    <li>
      Kwamba upande wowote unaweza kuvunja mkataba huu kwa kutoa taarifa ya
      maandishi ya si chini ya mwezi mmoja (1) kwa upande mwingine.
    </li>
    <li>
      Kwamba mkataba huu utakapokwisha au kuvunjwa, <strong>MPANGAJI</strong>
      atahama na kukabidhi funguo zote kwa <strong>MPANGISHAJI</strong>.
    </li>
    <li>
      Kwamba mgogoro wowote utakaotokana na mkataba huu utatatuliwa kwanza kwa
      majadiliano baina ya pande zote mbili, na ikishindikana, kwa mujibu wa
      sheria za Jamhuri ya Muungano wa Tanzania.
    </li>
  </ol>

  <p>
    Endapo kutatokea dharura, <strong>MPANGAJI</strong> anaweza kupatikana kupitia
    {{tenant_next_of_kin}} kwa simu {{tenant_next_of_kin_phone}}.
  </p>

  <p>
    <strong>KWA USHAHIDI WA HAYO</strong>, pande zote mbili zimesaini mkataba
    huu siku na mwaka uliotajwa hapo juu.
  </p>

  <table class="signatures">
    <tr>
      <td>
        <div class="signature-slot">{{landlord_signature}}</div>
        <strong>MPANGISHAJI</strong><br />{{landlord_name}}
      </td>
      <td>
        <div class="signature-slot">{{tenant_signature}}</div>
        <strong>MPANGAJI</strong><br />{{tenant_name}}
      </td>
    </tr>
    <tr>
      <td>
        <div class="rule"></div>
        Shahidi (jina, saini, tarehe)
      </td>
      <td>
        <div class="rule"></div>
        Shahidi (jina, saini, tarehe)
      </td>
    </tr>
  </table>
</div>`;

const STARTERS: Record<LeaseTemplateLanguage, string> = {
  en: ENGLISH,
  sw: SWAHILI,
};

export function starterBody(language: LeaseTemplateLanguage) {
  return STARTERS[language];
}

/** Whether a body is still one of the untouched starters — see `LeaseTemplateForm`. */
export function isStarterBody(body: string) {
  return Object.values(STARTERS).some((starter) => starter === body);
}

/**
 * The name an auto-created template is filed under. Fixed rather than
 * generated, so the `@@unique([organizationId, name])` index is what stops two
 * workers racing to create a second one.
 */
export const DEFAULT_TEMPLATE_NAME = "Standard tenancy agreement";

export const DEFAULT_TEMPLATE_DESCRIPTION =
  "Created automatically so a lease could be contracted. It is the standard " +
  "starter — review the wording and edit it to match what this organization " +
  "actually agrees with its tenants.";

/**
 * Writes the starter template for a brand-new organization, **inside the
 * transaction that is creating it**.
 *
 * Seeded up front rather than conjured on first use, for the reason
 * registration already pre-creates the Tenant role: a thing every organization
 * needs is better created once, visibly, at a moment that cannot half-succeed,
 * than lazily by whichever code path happens to notice it missing. It also
 * means Settings → Lease templates is never an empty page on day one, which is
 * where the wording is supposed to be reviewed before any lease is signed.
 *
 * Takes the transaction client rather than using the shared `prisma`: run
 * outside the caller's transaction this could commit a template for an
 * organization whose own insert then rolls back.
 *
 * Deliberately a plain insert, not `createLeaseTemplate`. That function opens
 * a transaction of its own (which cannot nest here), checks for a duplicate
 * name and demotes a sibling default — three things that are all no-ops for an
 * organization created seconds ago with no templates at all. `body` is this
 * app's own constant, so there is nothing to sanitize that the editor does not
 * already sanitize on the way back in.
 */
export async function seedDefaultLeaseTemplate(
  tx: Prisma.TransactionClient,
  organizationId: string
) {
  return tx.leaseTemplate.create({
    data: {
      organizationId,
      name: DEFAULT_TEMPLATE_NAME,
      description: DEFAULT_TEMPLATE_DESCRIPTION,
      language: "en",
      body: starterBody("en"),
      isDefault: true,
    },
    select: { id: true },
  });
}
