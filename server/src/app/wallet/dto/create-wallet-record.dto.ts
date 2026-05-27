import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateWalletRecordDto {
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
}
