<?php

namespace App\Policies;

use App\Models\SoftwareLicense;
use App\Models\User;

class SoftwareLicensePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, SoftwareLicense $softwareLicense): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isManager();
    }

    public function update(User $user, SoftwareLicense $softwareLicense): bool
    {
        return $user->isAdmin() || $user->isManager();
    }

    public function delete(User $user, SoftwareLicense $softwareLicense): bool
    {
        return $user->isAdmin() || $user->isManager();
    }

    public function assignSeat(User $user, SoftwareLicense $softwareLicense): bool
    {
        return $user->isAdmin() || $user->isManager();
    }

    public function revokeSeat(User $user, SoftwareLicense $softwareLicense): bool
    {
        return $user->isAdmin() || $user->isManager();
    }

    public function exportCsv(User $user): bool
    {
        return $user->isAdmin() || $user->isManager();
    }
}
