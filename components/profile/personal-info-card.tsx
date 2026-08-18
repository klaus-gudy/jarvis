"use client";

import * as React from "react";
import { MailIcon, PencilIcon, PhoneIcon, UserRoundIcon } from "lucide-react";

import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { ProfileField } from "@/components/profile/profile-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type PersonalInfo = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

export function PersonalInfoCard({
  personal,
  /** Null when the user belongs to no organization — nothing to edit through. */
  membershipId,
}: {
  personal: PersonalInfo;
  membershipId: string | null;
}) {
  const [editing, setEditing] = React.useState(false);

  return (
    <>
      <Card>
        <ProfileCardHeader
          title="Personal information"
          action={
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              disabled={membershipId === null}
            >
              <PencilIcon />
              Edit profile
            </Button>
          }
        />

        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {/*
              One field, not First/Last. `User.name` is a single column, and the
              tenant importer already establishes that a split is joined on the
              way in and never persisted (Phase 29) — showing two boxes here
              would invent a split the database cannot round-trip.
            */}
            <ProfileField
              label="Full name"
              value={personal.name}
              icon={UserRoundIcon}
              required
            />
            <ProfileField
              label="Phone number"
              value={personal.phone}
              icon={PhoneIcon}
              required
            />
            <ProfileField
              label="Email address"
              value={personal.email}
              icon={MailIcon}
              className="sm:col-span-2"
            />
          </dl>
        </CardContent>
      </Card>

      {/* Keyed so each open re-seeds the form from the current values. */}
      {editing && membershipId && (
        <EditProfileDialog
          key={`edit-${String(editing)}`}
          open
          onOpenChange={setEditing}
          membershipId={membershipId}
          initial={personal}
        />
      )}
    </>
  );
}
