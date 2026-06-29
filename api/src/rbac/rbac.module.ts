import { Module } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { AdminSeedModule } from './admin-seed.module';

// RolesGuard is registered per-controller via `@UseGuards(JwtAuthGuard, RolesGuard)`
// so it runs AFTER JwtAuthGuard has populated `req.user`.
//
// Registering RolesGuard as APP_GUARD here would run it BEFORE the
// controller-level @UseGuards, which means it would see req.user === undefined
// on protected routes and throw 403 "Access denied" even with a valid token.
// See bug bugs/rolesguard-app-guard-order.
@Module({
  imports: [AdminSeedModule],
  providers: [RolesGuard],
  exports: [RolesGuard],
})
export class RbacModule {}