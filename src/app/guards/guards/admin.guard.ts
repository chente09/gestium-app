import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserAreaService } from '../../services/userArea/user-area.service';
import { UsersService } from '../../services/users/users.service';
import { NzMessageService } from 'ng-zorro-antd/message';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private userAreaService: UserAreaService,
    private usersService: UsersService,
    private router: Router,
    private message: NzMessageService
  ) {}

  async canActivate(): Promise<boolean> {
    const user = this.usersService.getCurrentUser();
    
    if (!user) {
      this.message.error('Debe iniciar sesión para acceder a esta página');
      this.router.navigate(['/login']);
      return false;
    }

    try {
      const userInfo = await this.userAreaService.getUserAreaInfo(user.uid);
      
      if (userInfo?.role === 'admin') {
        return true;
      } else {
        this.message.error('No tiene permisos de administrador para acceder a esta página');
        this.router.navigate(['/welcome']);
        return false;
      }
    } catch (error) {
      console.error('Error verificando permisos de admin:', error);
      this.message.error('Error verificando permisos');
      this.router.navigate(['/welcome']);
      return false;
    }
  }
}