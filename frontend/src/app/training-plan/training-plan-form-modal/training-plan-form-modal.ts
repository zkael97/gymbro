import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import {
  TrainingPlan,
  WorkoutDay,
  DayOfWeek
} from '../../models/training-plan.model';
import { GymMoveItem } from '../../firebase.service';

@Component({
  selector: 'app-training-plan-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './training-plan-form-modal.html',
  styleUrl: './training-plan-form-modal.css'
})
export class TrainingPlanFormModal implements OnInit {
  @Input() initialPlan: TrainingPlan | null = null;
  @Input() gymMoves: GymMoveItem[] = [];
  @Input() isSubmitting = false;

  @Output() save = new EventEmitter<Partial<TrainingPlan>>();
  @Output() cancel = new EventEmitter<void>();

  private fb = inject(FormBuilder);

  planForm!: FormGroup;
  selectedDayIndex = signal<number>(0);

  readonly daysOfWeekOrder: { key: DayOfWeek; label: string }[] = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.planForm = this.fb.group({
      title: [this.initialPlan?.title || '', [Validators.required, Validators.minLength(3)]],
      description: [this.initialPlan?.description || ''],
      isActive: [this.initialPlan?.isActive ?? true],
      days: this.fb.array(this.buildDaysArray())
    });
  }

  get daysArray(): FormArray {
    return this.planForm.get('days') as FormArray;
  }

  getDayFormGroup(index: number): FormGroup {
    return this.daysArray.at(index) as FormGroup;
  }

  getExercisesArray(dayIndex: number): FormArray {
    return this.getDayFormGroup(dayIndex).get('exercises') as FormArray;
  }

  getExerciseFormGroup(dayIndex: number, exerciseIndex: number): FormGroup {
    return this.getExercisesArray(dayIndex).at(exerciseIndex) as FormGroup;
  }

  getSetsArray(dayIndex: number, exerciseIndex: number): FormArray {
    return this.getExerciseFormGroup(dayIndex, exerciseIndex).get('sets') as FormArray;
  }

  getSetFormGroup(dayIndex: number, exerciseIndex: number, setIndex: number): FormGroup {
    return this.getSetsArray(dayIndex, exerciseIndex).at(setIndex) as FormGroup;
  }

  private buildDaysArray(): FormGroup[] {
    return this.daysOfWeekOrder.map((dayItem) => {
      const existingDay = this.initialPlan?.days?.find((d) => d.dayOfWeek === dayItem.key);

      const exercisesFormArray = this.fb.array(
        existingDay?.exercises?.map((ex) => this.buildExerciseGroup(ex)) || []
      );

      return this.fb.group({
        dayOfWeek: [dayItem.key, Validators.required],
        title: [existingDay?.title || (dayItem.key === 'sunday' ? 'Rest Day' : `${dayItem.label} Workout`), Validators.required],
        isRestDay: [existingDay?.isRestDay ?? (dayItem.key === 'sunday')],
        notes: [existingDay?.notes || ''],
        exercises: exercisesFormArray
      });
    });
  }

  private buildExerciseGroup(ex?: any): FormGroup {
    const sets = ex?.sets && ex.sets.length > 0
      ? ex.sets.map((s: any, idx: number) => this.buildSetGroup(s.setNumber || idx + 1, s.targetReps, s.targetWeightKg))
      : [this.buildSetGroup(1, 10, 0), this.buildSetGroup(2, 10, 0), this.buildSetGroup(3, 10, 0)];

    return this.fb.group({
      name: [ex?.name || '', [Validators.required]],
      category: [ex?.category || 'Chest'],
      gymMoveId: [ex?.gymMoveId || ''],
      notes: [ex?.notes || ''],
      sets: this.fb.array(sets)
    });
  }

  private buildSetGroup(setNumber: number, targetReps = 10, targetWeightKg = 0): FormGroup {
    return this.fb.group({
      setNumber: [setNumber, [Validators.required, Validators.min(1)]],
      targetReps: [targetReps, [Validators.required, Validators.min(1)]],
      targetWeightKg: [targetWeightKg, [Validators.min(0)]],
      restSeconds: [60]
    });
  }

  selectDay(index: number): void {
    this.selectedDayIndex.set(index);
  }

  toggleRestDay(dayIndex: number): void {
    const dayGroup = this.getDayFormGroup(dayIndex);
    const currentVal = dayGroup.get('isRestDay')?.value;
    dayGroup.patchValue({ isRestDay: !currentVal });
  }

  addExercise(dayIndex: number): void {
    this.getExercisesArray(dayIndex).push(this.buildExerciseGroup());
  }

  removeExercise(dayIndex: number, exerciseIndex: number): void {
    this.getExercisesArray(dayIndex).removeAt(exerciseIndex);
  }

  isMoveSelectedInDay(dayIndex: number, moveId: string | undefined): boolean {
    if (!moveId) return false;
    const exercises = this.getExercisesArray(dayIndex).value;
    return exercises.some((e: any) => e.gymMoveId === moveId);
  }

  toggleMoveSelection(dayIndex: number, move: GymMoveItem, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    const exercisesArray = this.getExercisesArray(dayIndex);

    if (isChecked) {
      // Add exercise if not already present
      const exists = exercisesArray.controls.some((ctrl) => ctrl.get('gymMoveId')?.value === move.id);
      if (!exists) {
        exercisesArray.push(
          this.buildExerciseGroup({
            name: move.title,
            category: move.category,
            gymMoveId: move.id
          })
        );
      }
    } else {
      // Remove exercise matching this gymMoveId
      const indexToRemove = exercisesArray.controls.findIndex(
        (ctrl) => ctrl.get('gymMoveId')?.value === move.id
      );
      if (indexToRemove !== -1) {
        exercisesArray.removeAt(indexToRemove);
      }
    }
  }

  selectAllMoves(dayIndex: number): void {
    const exercisesArray = this.getExercisesArray(dayIndex);
    this.gymMoves.forEach((move) => {
      const exists = exercisesArray.controls.some((ctrl) => ctrl.get('gymMoveId')?.value === move.id);
      if (!exists) {
        exercisesArray.push(
          this.buildExerciseGroup({
            name: move.title,
            category: move.category,
            gymMoveId: move.id
          })
        );
      }
    });
  }

  clearAllMoves(dayIndex: number): void {
    const exercisesArray = this.getExercisesArray(dayIndex);
    // Remove all exercises that originated from gymMoves
    for (let i = exercisesArray.length - 1; i >= 0; i--) {
      if (exercisesArray.at(i).get('gymMoveId')?.value) {
        exercisesArray.removeAt(i);
      }
    }
  }

  onGymMoveSelect(dayIndex: number, exerciseIndex: number, event: Event): void {
    const selectElem = event.target as HTMLSelectElement;
    const selectedId = selectElem.value;
    const foundMove = this.gymMoves.find((m) => m.id === selectedId);
    if (foundMove) {
      const exGroup = this.getExercisesArray(dayIndex).at(exerciseIndex);
      exGroup.patchValue({
        name: foundMove.title,
        category: foundMove.category,
        gymMoveId: foundMove.id
      });
    }
  }

  addSet(dayIndex: number, exerciseIndex: number): void {
    const sets = this.getSetsArray(dayIndex, exerciseIndex);
    const nextSetNumber = sets.length + 1;
    sets.push(this.buildSetGroup(nextSetNumber, 10, 0));
  }

  removeSet(dayIndex: number, exerciseIndex: number, setIndex: number): void {
    const sets = this.getSetsArray(dayIndex, exerciseIndex);
    if (sets.length > 1) {
      sets.removeAt(setIndex);
      // Re-number sets
      sets.controls.forEach((ctrl, idx) => {
        ctrl.patchValue({ setNumber: idx + 1 });
      });
    }
  }

  onSubmit(): void {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }
    this.save.emit(this.planForm.value);
  }

  onClose(): void {
    this.cancel.emit();
  }
}
