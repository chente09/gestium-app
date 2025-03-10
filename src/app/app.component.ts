import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterModule, RouterOutlet } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { RegistersService } from './services/registers/registers.service';
import { UsersService } from './services/users/users.service';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';


import { NzFlexModule } from 'ng-zorro-antd/flex';

import { NzToolTipModule } from 'ng-zorro-antd/tooltip';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink, 
    RouterOutlet, 
    NzIconModule, 
    NzLayoutModule, 
    NzMenuModule,
    RouterModule,
    CommonModule,
    NzAvatarModule,
    NzDropDownModule,
    NzFlexModule,
    NzToolTipModule,
    NzDrawerModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  isCollapsed = false;
  isDrawerOpen = false;
  activeRoute = '';
 

  menuItems = [
    { title: 'ISSFA', route: '/issfa' },
    { title: 'Inmobiliaria', route: '/inmobiliaria' },
    { title: 'Bco Produbanco', route: '/produbanco' },
    { title: 'Bco Pichincha', route: null } // Este no tiene ruta
  ];

  constructor(
    private router: Router,
    public registersService: RegistersService,
    public usersService: UsersService  
  ) {}

  getCurrentUserName(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.displayName : null;
  }

  ngOnInit() {
    this.activeRoute = this.router.url; // Captura la ruta activa al iniciar
  }

  setActive(route: string | null) {
    this.activeRoute = route ?? '';
  }

  toggleMenu() {
    this.isCollapsed = !this.isCollapsed;
  }

  irWelcome() {
    this.router.navigate(['/welcome']);
  }

  isLogged(): boolean {
    return this.usersService.getCurrentUser() !== null;
  }

  logout(): void {
    this.registersService.currentRegister = undefined;
    this.usersService.logout();
    localStorage.clear();  // O sessionStorage.clear();
    this.router.navigate(['/login']);
  }

  openDrawer() {
    this.isDrawerOpen = true;
  }
  
  closeDrawer() {
    this.isDrawerOpen = false;
  }
}
