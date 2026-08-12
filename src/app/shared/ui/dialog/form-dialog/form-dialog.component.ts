import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormDialogData, FormDialogResult } from '@core/models/dialog.interface';

@Component({
  selector: 'app-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDialogModule,
    MatButtonModule,
  ],
  templateUrl: './form-dialog.component.html',
  styleUrl: './form-dialog.component.scss',
})
export class FormDialogComponent {
  readonly dialogData = inject<FormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<FormDialogComponent, FormDialogResult[] | false>);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.group(
    this.dialogData.form.reduce((controls, field) => {
      const defaultValue = field.inputType === 'checkbox' ? false : null;
      const validators = field.inputRequired ? [Validators.required] : [];
      controls[field.inputKey] = this.formBuilder.control(defaultValue, {
        validators,
        nonNullable: false,
      });
      return controls;
    }, {} as Record<string, unknown>),
  );

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    if (!this.form.valid) return;
    const result: FormDialogResult[] = Object.entries(this.form.getRawValue()).map(
      ([label, value]) => ({ label, value }),
    );
    this.dialogRef.close(result);
  }
}