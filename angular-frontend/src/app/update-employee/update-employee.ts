import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Employee } from '../employee';
import { EmployeeService } from '../employee-service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-update-employee',
  imports: [FormsModule],
  templateUrl: './update-employee.html',
  styleUrl: './update-employee.css',
})
export class UpdateEmployee implements OnInit{
  id!:number;
  constructor(private employeeService:EmployeeService,
    private route:ActivatedRoute,
  private router:Router ){

  }
  employee: Employee=new Employee();
  originalEmployee!: Employee;
  goToEmployeeList() {
    this.router.navigate(['/employees']);
  }
  onSubmit(){
    this.router.navigate(['/employees'], {
      state: {
        pendingAction: 'UPDATE',
        employee: this.employee,
        originalEmployee: this.originalEmployee
      }
    });
  }
  ngOnInit(): void {
      this.id=this.route.snapshot.params["id"];
      this.employeeService.getEmployeeById(this.id).subscribe(data=>{
        this.employee=data;
        this.originalEmployee = { ...data };
      },error=>console.log(error));
  }

}
