import { IsString, IsNotEmpty } from 'class-validator';

export class CreateWalletRecordDto {
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
