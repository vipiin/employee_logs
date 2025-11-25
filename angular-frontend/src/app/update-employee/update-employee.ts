import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgModel } from '@angular/forms';
import { Employee } from '../employee';
import { EmployeeService } from '../employee-service';
import { ActivatedRoute, Router } from '@angular/router';
import { errorContext } from 'rxjs/internal/util/errorContext';

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
  goToEmployeeList() {
    this.router.navigate(['/employees']);
  }
  onSubmit(){
    this.employeeService.updateEmployee(this.id,this.employee).subscribe(data=>{
      this.goToEmployeeList();
    },
  error=>console.log(error)
  );
  }
  ngOnInit(): void {
      this.id=this.route.snapshot.params["id"];
      this.employeeService.getEmployeeById(this.id).subscribe(data=>{
        this.employee=data;
      },error=>console.log(error));
  }

}
