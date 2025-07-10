import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserAreaAdminComponent } from './user-area-admin.component';

describe('UserAreaAdminComponent', () => {
  let component: UserAreaAdminComponent;
  let fixture: ComponentFixture<UserAreaAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAreaAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserAreaAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
