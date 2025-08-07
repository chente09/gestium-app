import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

// NG-Zorro Imports
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzGridModule } from 'ng-zorro-antd/grid';

@Component({
  selector: 'app-busqueda-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzSelectModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzGridModule
  ],
  templateUrl: './busqueda-form.component.html',
  styleUrls: ['./busqueda-form.component.css']
})
export class BusquedaFormComponent implements OnInit {
  @Output() onSearch = new EventEmitter<{ tipo: string, valor: string }>();
  searchForm: FormGroup;

  tiposBusqueda = [
    { label: 'Cédula', value: 'cedula' },
    { label: 'Nombre', value: 'nombre' },
  ];

  constructor(private fb: FormBuilder) {
    this.searchForm = this.fb.group({
      tipoBusqueda: ['cedula', Validators.required],
      valorBusqueda: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.searchForm.get('tipoBusqueda')?.valueChanges.subscribe(valor => {
      const valorBusquedaControl = this.searchForm.get('valorBusqueda');
      valorBusquedaControl?.clearValidators();
      if (valor === 'cedula') {
        valorBusquedaControl?.setValidators([Validators.required, Validators.pattern('^[0-9]{10}$')]);
      } else {
        valorBusquedaControl?.setValidators([Validators.required, Validators.minLength(3)]);
      }
      valorBusquedaControl?.updateValueAndValidity();
    });
  }

  submitForm(): void {
    if (this.searchForm.valid) {
      this.onSearch.emit({
        tipo: this.searchForm.value.tipoBusqueda,
        valor: this.searchForm.value.valorBusqueda
      });
    } else {
      Object.values(this.searchForm.controls).forEach(control => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
    }
  }
}
