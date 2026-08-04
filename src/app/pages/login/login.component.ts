import { Component } from '@angular/core';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { RegistersService } from '../../services/registers/registers.service';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzCardModule } from 'ng-zorro-antd/card';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    ReactiveFormsModule,
    NzCheckboxModule,
    NzIconModule,
    NzCardModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  form: FormGroup;
  registerForm: FormGroup;
  isRegistering = false;
  isLoading = false;

  constructor(
    private registerService: RegistersService,
    private formBuilder: FormBuilder,
    private router: Router,
    private message: NzMessageService
  ) {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email, this.emailGestiumValidator]],
      password: ['', Validators.required]
    });

    this.registerForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email, this.emailGestiumValidator]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      displayName: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  // Validador para dominio @gestium
  emailGestiumValidator(control: AbstractControl): ValidationErrors | null {
    const email = control.value?.trim();
    return email && email.includes('gestium') ? null : { gestiumEmail: true };
  }

  // Validador para contraseñas coincidentes
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  // 🔐 Login con email/password
  async onClickLogin(): Promise<void> {
    if (this.form.invalid) {
      this.message.warning('Por favor, complete todos los campos correctamente.');
      return;
    }

    this.isLoading = true;
    
    try {
      const register = await this.registerService.login(this.form.value);
      
      if (register) {
        this.message.success('Inicio de sesión exitoso');
        this.router.navigate(['/welcome']);
        this.resetForms();
      } else {
        this.message.error('No se pudo iniciar sesión. Verifique sus credenciales.');
      }
    } catch (error: any) {
      console.error('Error en login:', error);
      
      // Mensajes de error más específicos
      if (error.code === 'auth/user-not-found') {
        this.message.error('Usuario no encontrado');
      } else if (error.code === 'auth/wrong-password') {
        this.message.error('Contraseña incorrecta');
      } else if (error.code === 'auth/invalid-credential') {
        this.message.error('Credenciales inválidas');
      } else {
        this.message.error('Error al iniciar sesión');
      }
    } finally {
      this.isLoading = false;
    }
  }

  // 📝 Registro manual con email/password
  async onClickRegister(): Promise<void> {
    if (this.registerForm.invalid) {
      this.message.warning('Por favor, complete todos los campos correctamente.');
      return;
    }

    this.isLoading = true;

    try {
      const { email, password, displayName } = this.registerForm.value;
      
      await this.registerService.createRegister(
        { email, password },
        { displayName }
      );
      
      this.message.success('Registro exitoso. Ahora puede iniciar sesión.');
      this.isRegistering = false;
      this.resetForms();
      
    } catch (error: any) {
      console.error('Error en registro:', error);
      
      // Mensajes de error específicos
      if (error.code === 'auth/email-already-in-use') {
        this.message.error('Este correo ya está registrado');
      } else if (error.code === 'auth/weak-password') {
        this.message.error('La contraseña es muy débil');
      } else {
        this.message.error('Error durante el registro');
      }
    } finally {
      this.isLoading = false;
    }
  }

  // 🔐 Login con Google (auto-registro incluido)
  async onClickLoginGoogle(): Promise<void> {
    this.isLoading = true;
    
    try {
      const register = await this.registerService.loginWithGoogle();
      
      if (register) {
        this.message.success(`Bienvenido ${register.displayName || register.nickname || register.email}`);
        this.router.navigate(['/welcome']);
      } else {
        this.message.error('No se pudo completar el inicio de sesión');
      }
      
    } catch (error: any) {
      console.error('Error en login con Google:', error);
      
      if (error.message?.includes('gestium')) {
        this.message.warning('Solo correos con dominio @gestium pueden acceder');
      } else if (error.code === 'auth/popup-closed-by-user') {
        this.message.info('Inicio de sesión cancelado');
      } else {
        this.message.error('Error durante el inicio de sesión con Google');
      }
    } finally {
      this.isLoading = false;
    }
  }

  // 🔄 Toggle entre login y registro
  toggleRegister(): void {
    this.isRegistering = !this.isRegistering;
    this.resetForms();
  }

  // 🧹 Resetear formularios
  resetForms(): void {
    this.form.reset();
    this.registerForm.reset();
  }
}