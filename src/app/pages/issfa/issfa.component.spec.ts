import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IssfaComponent } from './issfa.component';

describe('IssfaComponent', () => {
  let component: IssfaComponent;
  let fixture: ComponentFixture<IssfaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IssfaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IssfaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
