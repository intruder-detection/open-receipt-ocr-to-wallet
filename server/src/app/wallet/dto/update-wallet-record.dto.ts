import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class UpdateWalletRecordDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @IsNotEmpty()
  fileId: number;

  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  note: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  recordDate: string;

  @IsOptional()
  @IsString()
  counterParty?: string;
}
